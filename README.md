# 0G Broker Starter Kit

这是一个使用 0G Serving Broker 的简单示例项目，专为初学者设计，展示如何构建去中心化 AI 应用。

## 功能概览

本项目实现了 0G Serving Broker 的核心功能：

1. **Broker 实例构建** - 创建和初始化 broker 连接
2. **账户充值** - 管理账本和充值 A0GI 代币
3. **服务验证** - 验证 AI 服务提供者
4. **Chat 对话** - 与 AI 模型进行交互
5. **内容验证** - 验证 AI 回复的真实性
6. **🤖 AI 交易机器人** - 使用 AI 分析加密货币市场并提供交易建议（新功能！）

## 核心概念

### 1. Broker 实例
```typescript
import { createZGComputeNetworkBroker } from '@0glabs/0g-serving-broker';

// 使用钱包签名者创建 broker
const broker = await createZGComputeNetworkBroker(signer);
```

### 2. 账本管理
```typescript
// 创建账本并充值
await broker.ledger.addLedger(amount);

// 为已有账本充值
await broker.ledger.depositFund(amount);

// 查询账本信息
const { ledgerInfo } = await broker.ledger.ledger.getLedgerWithDetail();
```

### 3. 服务验证
```typescript
// 获取服务元数据
const metadata = await broker.inference.getServiceMetadata(providerAddress);

// 验证服务（acknowledge）
await broker.inference.acknowledge(providerAddress);

// 检查是否已验证
const isAcknowledged = await broker.inference.userAcknowledged(providerAddress);
```

### 4. Chat 对话
```typescript
// 获取请求头（包含认证信息）
const headers = await broker.inference.getRequestHeaders(
  providerAddress,
  JSON.stringify(messages)
);

// 发送请求到 AI 服务
const response = await fetch(`${endpoint}/chat/completions`, {
  method: 'POST',
  headers: { ...headers },
  body: JSON.stringify({ messages, model, stream: true })
});
```

### 5. 内容验证
```typescript
// 处理响应并验证内容
const isValid = await broker.inference.processResponse(
  providerAddress,
  responseContent,
  chatId
);
```

## 快速开始

### 安装依赖
```bash
pnpm install
```

### 配置项目

1. 在 `pages/_app.tsx` 中设置 WalletConnect Project ID：
```typescript
const config = getDefaultConfig({
  appName: '0G Broker Starter Kit',
  projectId: 'YOUR_PROJECT_ID', // 从 https://cloud.walletconnect.com 获取
  chains: [zgTestnet], // 0G 测试网
  ssr: true,
});
```

### 运行项目
```bash
pnpm run dev
```

访问 http://localhost:3000

## 使用流程

### 基础功能
1. **连接钱包** - 使用 MetaMask 或其他钱包连接到 0G 测试网
2. **创建账本** - 在"账户"标签页创建账本并充值 A0GI
3. **验证服务** - 在"服务"标签页选择并验证 AI 服务提供者
4. **开始对话** - 在"聊天"标签页与 AI 进行交互
5. **验证内容** - 系统自动验证 AI 回复的真实性

### 🤖 AI 交易机器人（新功能）
6. **启动交易机器人** - 在"交易机器人"标签页开始使用
7. **实时价格监控** - 自动获取币安期货的实时价格数据
8. **AI 市场分析** - 选择交易对，让 AI 分析市场趋势
9. **获取交易建议** - 获得包括趋势、入场价、止损位等专业建议
10. **验证分析结果** - 所有 AI 建议都经过零知识证明验证

详细的交易机器人使用文档请参考：[TRADING_BOT_README.md](./TRADING_BOT_README.md)

## 项目结构

```
0g-web-startkit/
├── components/              # React 组件
│   ├── AccountTab.tsx      # 账户管理组件
│   ├── ServiceTab.tsx      # 服务验证组件
│   ├── ChatTab.tsx         # Chat 对话组件
│   └── TradingBotTab.tsx   # 🤖 AI 交易机器人组件（新）
├── pages/                  # Next.js 页面
│   ├── _app.tsx           # 应用配置
│   └── index.tsx          # 主页
├── styles/                 # 样式文件
│   └── globals.css        # 全局样式
└── TRADING_BOT_README.md  # 交易机器人详细文档
```

## 🤖 AI 交易机器人功能特点

### 数据来源
- **实时价格**：从币安期货 API 获取实时价格数据
- **K线数据**：获取 15 分钟 K 线用于趋势分析
- **支持交易对**：BTC, ETH, BNB, SOL, XRP, ADA, DOGE, MATIC

### AI 分析能力
- **市场趋势判断**：识别上涨/下跌/横盘趋势
- **操作建议**：提供买入/卖出/观望建议
- **价格预测**：建议入场价、止损位、目标价
- **风险评估**：评估交易风险等级

### 技术创新
- **去中心化 AI**：使用 0G Compute Network 的分布式 AI 服务
- **零知识证明**：验证 AI 响应的真实性和完整性
- **自动刷新**：支持 5秒-1分钟的价格自动刷新
- **历史记录**：保存所有分析建议供对比参考

### ⚠️ 重要提示
本交易机器人仅供学习和研究使用，AI 生成的建议仅供参考，不构成投资建议。
加密货币交易具有高风险，请谨慎决策，自负盈亏。

## 相关资源

- [0G Labs 文档](https://docs.0g.ai)
- [0G Serving Broker NPM](https://www.npmjs.com/package/@0glabs/0g-serving-broker)
- [WalletConnect](https://cloud.walletconnect.com)
- [币安 API 文档](https://binance-docs.github.io/apidocs/futures/cn/)
- [交易机器人详细文档](./TRADING_BOT_README.md)
