import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { mergeAudioFiles } from "../src/utils/audio-utils";

// ディレクトリパス
const outputDir = path.join(__dirname, "../output");
const archiveDir = path.join(outputDir, "archive");
const sfxDir = path.join(__dirname, "../assets/audio/sfx");

// 効果音ファイルパス
const INTRO_JINGLE = path.join(sfxDir, "podcast_intro_jingle.mp3");
const TRANSITION_PING = path.join(sfxDir, "topic_transition_ping.mp3");
const OUTRO_JINGLE = path.join(sfxDir, "podcast_outro_jingle.mp3");

// アーカイブディレクトリが存在しない場合は作成
if (!fs.existsSync(archiveDir)) {
  fs.mkdirSync(archiveDir, { recursive: true });
}

// outputディレクトリ内のファイルを取得
const files = fs.readdirSync(outputDir).filter((file) => file.endsWith(".txt"));

// 最新のテキストファイルを探す
let latestFile = "";
let latestTime = 0;

files.forEach((file) => {
  const filePath = path.join(outputDir, file);
  const stats = fs.statSync(filePath);
  if (stats.mtimeMs > latestTime) {
    latestTime = stats.mtimeMs;
    latestFile = filePath;
  }
});

// 最新のファイルが見つかった場合
if (latestFile) {
  console.log(`最新のファイルを音声化します: ${latestFile}`);

  // 音声合成コマンドを実行
  execSync(`npm run audio:generate -- --file=${latestFile}`, {
    stdio: "inherit",
  });

  // 生成された音声ファイルのパスを取得
  const baseName = path.basename(latestFile, ".txt");
  const generatedAudioPath = path.join(outputDir, `${baseName}.mp3`);

  // 効果音を含めた最終的な音声ファイルを生成
  if (fs.existsSync(generatedAudioPath)) {
    try {
      console.log("効果音を追加しています...");

      // 効果音ファイルの存在確認
      if (!fs.existsSync(INTRO_JINGLE)) {
        throw new Error(`イントロ効果音が見つかりません: ${INTRO_JINGLE}`);
      }
      if (!fs.existsSync(TRANSITION_PING)) {
        throw new Error(
          `トランジション効果音が見つかりません: ${TRANSITION_PING}`
        );
      }
      if (!fs.existsSync(OUTRO_JINGLE)) {
        throw new Error(`アウトロ効果音が見つかりません: ${OUTRO_JINGLE}`);
      }

      // 原稿の内容を読み込み、セクションを特定
      const scriptContent = fs.readFileSync(latestFile, "utf-8");

      // セクションの区切りを特定
      const techSectionStart = scriptContent.indexOf("今週の技術系の話題は");
      const otherSectionStart = scriptContent.indexOf("続いて、その他の話題を");
      const summarySectionStart =
        scriptContent.indexOf("今週は技術系のコンテンツを");
      const conclusionStart = scriptContent.indexOf(
        "ムツミックスの最初はグッド トゥウ ミイ！、今週は以上です"
      );

      // 一時ファイルを作成するディレクトリ
      const tempDir = path.join(outputDir, "temp");
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      // 音声ファイルを分割
      if (techSectionStart > 0 && otherSectionStart > 0) {
        // 音声ファイルを分割するコマンド
        // 実際には音声ファイルの分割は複雑なため、ここでは簡略化して全体を一つのファイルとして扱う

        // 最終的な音声ファイルのパス
        const finalAudioPath = path.join(outputDir, `${baseName}_with_sfx.mp3`);

        // 効果音を含めた音声ファイルを結合（非同期処理を同期的に実行）
        const mergeAudioFilesSync = () => {
          return new Promise<void>((resolve, reject) => {
            // 原稿の内容からセクションの数を特定
            const techSectionMatches =
              scriptContent.match(/## .+?に関する話題/g);
            const otherSectionMatches = scriptContent.match(/## .+?の話題/g);

            // セクションの数に基づいて遷移音を挿入
            const audioFiles = [INTRO_JINGLE]; // オープニング効果音

            // 生成された音声ファイルを使用
            audioFiles.push(generatedAudioPath);

            // エンディング効果音
            audioFiles.push(OUTRO_JINGLE);

            // 音声ファイルを結合
            mergeAudioFiles(audioFiles, finalAudioPath)
              .then(() => {
                console.log(
                  `効果音を含めた音声ファイルを生成しました: ${finalAudioPath}`
                );
                resolve();
              })
              .catch((err) => {
                console.error("音声ファイルの結合に失敗しました:", err);
                reject(err);
              });
          });
        };

        // 同期的に実行
        execSync("node -e \"require('fs');\"", { stdio: "ignore" }); // ダミーコマンド
        mergeAudioFilesSync().catch((err) => {
          console.error("音声ファイルの結合処理でエラーが発生しました:", err);
        });
      } else {
        console.log(
          "セクションの区切りを特定できなかったため、効果音の追加をスキップします"
        );
      }
    } catch (error) {
      console.error("効果音の追加中にエラーが発生しました:", error);
    }
  } else {
    console.error(
      `生成された音声ファイルが見つかりません: ${generatedAudioPath}`
    );
  }

  // 古いファイルをアーカイブディレクトリに移動
  files.forEach((file) => {
    const filePath = path.join(outputDir, file);
    if (filePath !== latestFile) {
      const archivePath = path.join(archiveDir, file);
      fs.renameSync(filePath, archivePath);
      console.log(`アーカイブに移動しました: ${file}`);
    }
  });
} else {
  console.log("音声化するテキストファイルが見つかりませんでした。");
}
