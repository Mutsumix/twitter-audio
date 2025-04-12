/**
 * コマンドラインインターフェースユーティリティ
 * 引数の解析と対話型モードのサポート
 */
import readline from "readline";
import { logError, logInfo } from "./logger";

export type CommandOption = {
  name: string;
  alias?: string;
  description: string;
  type: "string" | "boolean" | "number" | "array";
  required?: boolean;
  default?: any;
};

export type Command = {
  name: string;
  description: string;
  options?: CommandOption[];
  handler: (args: Record<string, any>) => Promise<void>;
};

export type CommandResult = {
  command: string;
  args: Record<string, any>;
};

/**
 * コマンドライン引数をパース
 * @returns パースした引数オブジェクト
 */
export function parseArgs(): CommandResult {
  // コマンドライン引数の取得（最初の2つはnodeとスクリプトのパス）
  const args = process.argv.slice(2);

  // 引数がない場合は対話型モード
  if (args.length === 0) {
    return { command: "interactive", args: {} };
  }

  // 最初の引数をコマンド名として取得
  const command = args[0];
  const parsedArgs: Record<string, any> = {};

  // コマンドに続く引数をパース
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];

    // オプション引数（--key=value または --key）
    if (arg.startsWith("--")) {
      const eqIdx = arg.indexOf("=");
      if (eqIdx >= 0) {
        // --key=value 形式
        const key = arg.substring(2, eqIdx);
        const value = arg.substring(eqIdx + 1);

        // カンマ区切りの値は配列に変換
        if (value.includes(",")) {
          parsedArgs[key] = value.split(",").map((v) => v.trim());
        } else {
          parsedArgs[key] = value;
        }
      } else {
        // --key 形式はフラグオプションとして扱う
        parsedArgs[arg.substring(2)] = true;
      }
    }
    // 短縮形オプション（-k value または -k）
    else if (arg.startsWith("-") && arg.length == 2) {
      const key = arg.substring(1);
      // 次の引数が別のオプションではない場合、その値を取得
      if (i + 1 < args.length && !args[i + 1].startsWith("-")) {
        parsedArgs[key] = args[i + 1];
        i++; // 値を使用したので次の引数をスキップ
      } else {
        // 値がない場合はフラグとして扱う
        parsedArgs[key] = true;
      }
    }
    // 通常の引数（位置ベース）
    else {
      // 位置ベースの引数は現在サポートしていない
    }
  }

  return { command, args: parsedArgs };
}

/**
 * 対話型モードでコマンドを選択
 * @param commands 利用可能なコマンドのリスト
 * @returns 選択されたコマンドと引数
 */
export async function interactiveMode(
  commands: Command[]
): Promise<CommandResult> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  // 質問のプロミス化
  const question = (query: string): Promise<string> => {
    return new Promise((resolve) => {
      rl.question(query, (answer) => {
        resolve(answer);
      });
    });
  };

  try {
    console.log("\nTwitterお気に入りPodcast生成システム - 対話型モード\n");
    console.log("利用可能なコマンド:");

    // コマンド一覧を表示
    commands.forEach((cmd, index) => {
      console.log(`${index + 1}. ${cmd.name}: ${cmd.description}`);
    });
    console.log("");

    // コマンド選択
    const cmdIndex = await question(
      "実行するコマンドの番号を入力してください: "
    );
    const selectedIndex = parseInt(cmdIndex, 10) - 1;

    if (
      isNaN(selectedIndex) ||
      selectedIndex < 0 ||
      selectedIndex >= commands.length
    ) {
      throw new Error("無効なコマンド番号です");
    }

    const selectedCommand = commands[selectedIndex];
    console.log(`\n選択されたコマンド: ${selectedCommand.name}`);

    // オプション入力
    const args: Record<string, any> = {};

    if (selectedCommand.options && selectedCommand.options.length > 0) {
      console.log("\nオプションを入力してください:");

      for (const opt of selectedCommand.options) {
        // 必須オプションまたはプロンプトがある場合
        if (opt.required) {
          const input = await question(`${opt.name} (${opt.description}): `);

          if (!input && opt.required) {
            throw new Error(`オプション ${opt.name} は必須です`);
          }

          if (input) {
            // 型に応じた変換
            switch (opt.type) {
              case "number":
                args[opt.name] = parseFloat(input);
                break;
              case "boolean":
                args[opt.name] =
                  input.toLowerCase() === "true" || input === "1";
                break;
              case "array":
                args[opt.name] = input.split(",").map((item) => item.trim());
                break;
              default:
                args[opt.name] = input;
            }
          } else if (opt.default !== undefined) {
            args[opt.name] = opt.default;
          }
        }
      }
    }

    rl.close();
    return { command: selectedCommand.name, args };
  } catch (error) {
    rl.close();
    throw error;
  }
}

/**
 * 利用可能なコマンドの一覧と詳細を表示
 * @param commands コマンドのリスト
 */
export function displayHelp(commands: Command[]): void {
  console.log("\nTwitterお気に入りPodcast生成システム - ヘルプ\n");
  console.log("使用方法: npm run dev -- [コマンド] [オプション]\n");
  console.log("利用可能なコマンド:\n");

  const maxNameLength = Math.max(...commands.map((cmd) => cmd.name.length));

  commands.forEach((cmd) => {
    // コマンド名と説明を整形して表示
    console.log(`  ${cmd.name.padEnd(maxNameLength + 2)}${cmd.description}`);

    // オプションがあれば表示
    if (cmd.options && cmd.options.length > 0) {
      cmd.options.forEach((opt) => {
        const optName = opt.alias
          ? `--${opt.name}, -${opt.alias}`
          : `--${opt.name}`;
        const required = opt.required ? "[必須]" : "";
        console.log(`    ${optName.padEnd(20)} ${opt.description} ${required}`);
      });
      console.log("");
    }
  });

  console.log("\n例: npm run dev -- generate-podcast --no-jingle\n");
}

/**
 * オプション値の型変換
 * @param value 変換する値
 * @param type 変換先の型
 * @returns 変換された値
 */
export function convertOptionValue(
  value: any,
  type: CommandOption["type"]
): any {
  if (value === undefined) {
    return undefined;
  }

  switch (type) {
    case "string":
      return String(value);
    case "number":
      return Number(value);
    case "boolean":
      // 文字列の場合は変換
      if (typeof value === "string") {
        return value.toLowerCase() === "true" || value === "1";
      }
      return Boolean(value);
    case "array":
      // 既に配列の場合はそのまま
      if (Array.isArray(value)) {
        return value;
      }
      // カンマ区切りの文字列を配列に変換
      if (typeof value === "string") {
        return value.split(",").map((item) => item.trim());
      }
      return [value];
    default:
      return value;
  }
}

/**
 * コマンドラインアプリケーションの実行
 * @param commands 利用可能なコマンドのリスト
 */
export async function runCli(commands: Command[]): Promise<void> {
  try {
    // 引数のパース
    let result = parseArgs();

    // 対話型モード
    if (result.command === "interactive") {
      result = await interactiveMode(commands);
    }

    // ヘルプの表示
    if (result.command === "help") {
      displayHelp(commands);
      return;
    }

    // コマンド実行
    const command = commands.find((cmd) => cmd.name === result.command);

    if (!command) {
      console.error(`エラー: コマンド '${result.command}' は存在しません。`);
      console.log(
        "利用可能なコマンドを確認するには 'npm run dev -- help' を実行してください。"
      );
      process.exit(1);
    }

    // オプションの変換と検証
    const args: Record<string, any> = {};

    if (command.options) {
      for (const opt of command.options) {
        // 引数から値を取得（エイリアスも考慮）
        let value = result.args[opt.name];
        if (value === undefined && opt.alias) {
          value = result.args[opt.alias];
        }

        // デフォルト値の適用
        if (value === undefined && opt.default !== undefined) {
          value = opt.default;
        }

        // 必須チェック
        if (opt.required && value === undefined) {
          throw new Error(`オプション --${opt.name} は必須です`);
        }

        // 型変換
        if (value !== undefined) {
          args[opt.name] = convertOptionValue(value, opt.type);
        }
      }
    }

    // コマンド実行
    logInfo(`コマンド '${command.name}' を実行します`);
    await command.handler(args);
  } catch (error) {
    logError("コマンド実行中にエラーが発生しました", {
      error: error instanceof Error ? error.message : String(error),
    });

    // 対話型モード以外の場合はプロセス終了
    if (process.argv.length > 2) {
      process.exit(1);
    }
  }
}

export default {
  parseArgs,
  interactiveMode,
  displayHelp,
  runCli,
};
