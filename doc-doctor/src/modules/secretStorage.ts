import * as vscode from "vscode";

/**
 * SecretStorage 密钥存储键名
 */
const SECRET_KEY_API_KEY = "doc-doctor.ai.apiKey";

/**
 * 全局扩展上下文（在 activate 时设置）
 */
let extensionContext: vscode.ExtensionContext | undefined;

/**
 * 初始化 SecretStorage 模块
 * 必须在扩展激活时调用
 */
export function initSecretStorage(context: vscode.ExtensionContext): void {
  extensionContext = context;
  // 迁移旧配置：从 settings.json 迁移到 SecretStorage
  migrateApiKeyFromSettings().catch((err) => {
    console.error("[SecretStorage] 迁移 API Key 失败:", err);
  });
}

/**
 * 获取 API Key
 * @returns API Key，如果不存在则返回 undefined
 */
export async function getApiKey(): Promise<string | undefined> {
  if (!extensionContext) {
    console.warn(
      "[SecretStorage] Extension context 未初始化，无法读取 API Key"
    );
    return undefined;
  }

  try {
    const apiKey = await extensionContext.secrets.get(SECRET_KEY_API_KEY);
    return apiKey;
  } catch (error) {
    console.error("[SecretStorage] 读取 API Key 失败:", error);
    return undefined;
  }
}

/**
 * 保存 API Key
 * @param apiKey API Key 值，传入空字符串或 undefined 将删除密钥
 */
export async function setApiKey(apiKey: string | undefined): Promise<void> {
  if (!extensionContext) {
    throw new Error(
      "[SecretStorage] Extension context 未初始化，无法保存 API Key"
    );
  }

  try {
    if (apiKey && apiKey.trim()) {
      // 保存到 SecretStorage
      await extensionContext.secrets.store(SECRET_KEY_API_KEY, apiKey.trim());
      console.log("[SecretStorage] API Key 已安全保存到 SecretStorage");
    } else {
      // 删除密钥
      await extensionContext.secrets.delete(SECRET_KEY_API_KEY);
      console.log("[SecretStorage] API Key 已从 SecretStorage 删除");
    }

    // 同时从 settings.json 中移除 API Key（如果存在）
    await removeApiKeyFromSettings();
  } catch (error) {
    console.error("[SecretStorage] 保存 API Key 失败:", error);
    throw error;
  }
}

/**
 * 从 settings.json 中移除 API Key 配置项
 */
async function removeApiKeyFromSettings(): Promise<void> {
  try {
    const config = vscode.workspace.getConfiguration("doc-doctor");
    const currentValue = config.get<string>("ai.apiKey", "");
    if (currentValue) {
      // 只有在存在值时才清除，避免不必要的配置变更
      await config.update(
        "ai.apiKey",
        undefined,
        vscode.ConfigurationTarget.Workspace
      );
      console.log(
        "[SecretStorage] 已从 settings.json 中移除 ai.apiKey 配置"
      );
    }
  } catch (error) {
    console.warn(
      "[SecretStorage] 从 settings.json 移除 API Key 时出错（可忽略）:",
      error
    );
  }
}

/**
 * 从 settings.json 迁移 API Key 到 SecretStorage
 * 如果 settings.json 中存在 API Key，且 SecretStorage 中不存在，则迁移
 */
async function migrateApiKeyFromSettings(): Promise<void> {
  if (!extensionContext) {
    return;
  }

  try {
    // 检查 SecretStorage 中是否已有 API Key
    const existingKey = await extensionContext.secrets.get(SECRET_KEY_API_KEY);
    if (existingKey) {
      // SecretStorage 中已有，无需迁移
      console.log(
        "[SecretStorage] SecretStorage 中已存在 API Key，跳过迁移"
      );
      // 但仍需要从 settings.json 中移除
      await removeApiKeyFromSettings();
      return;
    }

    // 从 settings.json 读取
    const config = vscode.workspace.getConfiguration("doc-doctor");
    const apiKeyFromSettings = config.get<string>("ai.apiKey", "");

    if (apiKeyFromSettings && apiKeyFromSettings.trim()) {
      // 迁移到 SecretStorage
      await extensionContext.secrets.store(
        SECRET_KEY_API_KEY,
        apiKeyFromSettings.trim()
      );
      console.log(
        "[SecretStorage] 已从 settings.json 迁移 API Key 到 SecretStorage"
      );
      // 从 settings.json 中移除
      await removeApiKeyFromSettings();
    }
  } catch (error) {
    console.error("[SecretStorage] 迁移 API Key 失败:", error);
  }
}
