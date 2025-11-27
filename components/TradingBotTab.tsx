import { useState, useEffect } from "react";

interface TradingBotTabProps {
  broker: any;
  selectedProvider: any;
  message: string;
  setMessage: (message: string) => void;
}

interface PriceData {
  symbol: string;
  price: string;
  time?: number;
}

interface TradingAdvice {
  symbol: string;
  currentPrice: string;
  advice: string;
  timestamp: number;
  verified: boolean;
  verifyError?: boolean;
  id?: string;
}

export default function TradingBotTab({
  broker,
  selectedProvider,
  message,
  setMessage,
}: TradingBotTabProps) {
  const [selectedSymbol, setSelectedSymbol] = useState("BTCUSDT");
  const [priceData, setPriceData] = useState<PriceData[]>([]);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [tradingAdvices, setTradingAdvices] = useState<TradingAdvice[]>([]);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(10000); // 10秒
  const [verifyingAdviceId, setVerifyingAdviceId] = useState<string | null>(
    null
  );

  // 常用交易对
  const popularSymbols = [
    "BTCUSDT",
    "ETHUSDT",
    "BNBUSDT",
    "SOLUSDT",
    "XRPUSDT",
    "ADAUSDT",
    "DOGEUSDT",
    "MATICUSDT",
  ];

  // 获取币安价格数据
  const fetchBinancePrices = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        "https://fapi.binance.com/fapi/v1/ticker/price"
      );
      if (!response.ok) {
        throw new Error("获取价格数据失败");
      }
      const data = await response.json();

      // 只保留常用交易对
      const filteredData = data.filter((item: PriceData) =>
        popularSymbols.includes(item.symbol)
      );

      setPriceData(
        filteredData.map((item: PriceData) => ({
          ...item,
          time: Date.now(),
        }))
      );
      setMessage("价格数据更新成功");
      setTimeout(() => setMessage(""), 2000);
    } catch (err) {
      console.error("获取价格失败:", err);
      setMessage(
        "获取价格失败: " + (err instanceof Error ? err.message : String(err))
      );
    }
    setLoading(false);
  };

  // 分析交易对并获取建议
  const analyzeTradingPair = async (symbol: string) => {
    if (!broker || !selectedProvider) {
      setMessage("请先选择 AI 服务提供商");
      return;
    }

    setAnalyzing(true);
    setMessage(`正在分析 ${symbol}...`);

    try {
      // 获取该交易对的当前价格
      const targetPrice = priceData.find((p) => p.symbol === symbol);
      if (!targetPrice) {
        setMessage("未找到该交易对的价格数据");
        setAnalyzing(false);
        return;
      }

      // 获取历史数据用于分析（简化版本，实际应该获取K线数据）
      const klineResponse = await fetch(
        `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=15m&limit=20`
      );
      const klineData = await klineResponse.json();

      // 构建分析提示词
      const analysisPrompt = `作为一个专业的加密货币交易分析师，请分析以下交易对数据并给出交易建议：

交易对: ${symbol}
当前价格: ${targetPrice.price} USDT

最近15分钟K线数据（开盘价、最高价、最低价、收盘价）：
${klineData
  .map(
    (k: any, i: number) =>
      `${i + 1}. 开:${k[1]} 高:${k[2]} 低:${k[3]} 收:${k[4]} 成交量:${k[5]}`
  )
  .join("\n")}

请提供：
1. 当前市场趋势分析（上涨/下跌/横盘）
2. 建议操作（买入/卖出/观望）
3. 建议的入场价格区间
4. 止损位置
5. 目标价位
6. 风险评估

请用简洁专业的语言回答，不超过300字。`;

      const userMsg = { role: "user", content: analysisPrompt };

      // 获取 AI 服务元数据
      const metadata = await broker.inference.getServiceMetadata(
        selectedProvider.address
      );
      const headers = await broker.inference.getRequestHeaders(
        selectedProvider.address,
        JSON.stringify([userMsg])
      );

      // 确保有足够的余额
      let account;
      try {
        account = await broker.inference.getAccount(selectedProvider.address);
      } catch (error) {
        console.log("创建子账户并充值...");
        await broker.ledger.transferFund(
          selectedProvider.address,
          "inference",
          BigInt(0.01e18)
        );
        account = await broker.inference.getAccount(selectedProvider.address);
      }
      console.log("account余额：", account, account.balance);

      if (account.balance <= BigInt(0.22e18)) {
        console.log("子账户余额不足，正在充值...");
        await broker.ledger.transferFund(
          selectedProvider.address,
          "inference",
          BigInt(0.05e18)
        );
      }

      // 调用 AI 服务
      const response = await fetch(`${metadata.endpoint}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({
          messages: [userMsg],
          model: metadata.model,
          stream: false,
        }),
      });

      const result = await response.json();
      const advice: TradingAdvice = {
        symbol,
        currentPrice: targetPrice.price,
        advice: result.choices[0].message.content,
        timestamp: Date.now(),
        verified: false,
        id: result.id,
      };

      setTradingAdvices((prev) => [advice, ...prev]);
      setMessage("分析完成");

      // 处理验证和计费
      if (result.id) {
        setVerifyingAdviceId(result.id);
        setMessage("正在验证响应...");

        try {
          await broker.inference.processResponse(
            selectedProvider.address,
            advice.advice,
            result.id
          );

          setTradingAdvices((prev) =>
            prev.map((adv) =>
              adv.id === result.id ? { ...adv, verified: true } : adv
            )
          );
          setMessage("响应验证成功");
        } catch (verifyErr) {
          console.error("验证失败:", verifyErr);
          setMessage("响应验证失败");
          setTradingAdvices((prev) =>
            prev.map((adv) =>
              adv.id === result.id
                ? { ...adv, verified: false, verifyError: true }
                : adv
            )
          );
        } finally {
          setVerifyingAdviceId(null);
          setTimeout(() => setMessage(""), 3000);
        }
      }
    } catch (err) {
      console.error("分析失败:", err);
      setMessage(
        "分析失败: " + (err instanceof Error ? err.message : String(err))
      );
    }
    setAnalyzing(false);
  };

  // 自动刷新价格
  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(fetchBinancePrices, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval]);

  // 初始化时获取一次价格
  useEffect(() => {
    fetchBinancePrices();
  }, []);

  if (!selectedProvider) {
    return (
      <div>
        <h2>🤖 AI 交易机器人</h2>
        <p style={{ color: "#666", marginTop: "10px" }}>
          请先在"服务"标签页选择并验证 AI 服务提供商
        </p>
      </div>
    );
  }

  return (
    <div>
      <h2>🤖 AI 交易机器人</h2>
      <div
        style={{
          marginBottom: "20px",
          padding: "10px",
          background: "#f8f9fa",
          borderRadius: "5px",
        }}
      >
        <div style={{ fontSize: "14px", color: "#666", marginBottom: "10px" }}>
          当前 AI 服务: {selectedProvider.name} - {selectedProvider.model}
        </div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <button
            onClick={fetchBinancePrices}
            disabled={loading}
            style={{
              padding: "8px 16px",
              background: "#28a745",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? "刷新中..." : "🔄 刷新价格"}
          </button>
          <label style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            <span style={{ fontSize: "14px" }}>自动刷新</span>
          </label>
          <select
            value={refreshInterval}
            onChange={(e) => setRefreshInterval(Number(e.target.value))}
            disabled={!autoRefresh}
            style={{
              padding: "5px",
              borderRadius: "4px",
              border: "1px solid #ddd",
            }}
          >
            <option value={5000}>5秒</option>
            <option value={10000}>10秒</option>
            <option value={30000}>30秒</option>
            <option value={60000}>1分钟</option>
          </select>
        </div>
      </div>

      {/* 价格面板 */}
      <div style={{ marginBottom: "20px" }}>
        <h3 style={{ fontSize: "16px", marginBottom: "10px" }}>
          📊 实时价格（币安期货）
        </h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
            gap: "10px",
          }}
        >
          {priceData.map((price) => (
            <div
              key={price.symbol}
              onClick={() => setSelectedSymbol(price.symbol)}
              style={{
                padding: "12px",
                border:
                  selectedSymbol === price.symbol
                    ? "2px solid #007bff"
                    : "1px solid #ddd",
                borderRadius: "8px",
                cursor: "pointer",
                background:
                  selectedSymbol === price.symbol ? "#e7f3ff" : "white",
                transition: "all 0.2s",
              }}
            >
              <div
                style={{
                  fontSize: "14px",
                  fontWeight: "bold",
                  marginBottom: "5px",
                }}
              >
                {price.symbol.replace("USDT", "/USDT")}
              </div>
              <div style={{ fontSize: "16px", color: "#28a745" }}>
                ${parseFloat(price.price).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 分析按钮 */}
      <div style={{ marginBottom: "20px" }}>
        <button
          onClick={() => analyzeTradingPair(selectedSymbol)}
          disabled={analyzing || !selectedSymbol}
          style={{
            padding: "12px 24px",
            background: "#007bff",
            color: "white",
            border: "none",
            borderRadius: "4px",
            fontSize: "16px",
            cursor: analyzing ? "not-allowed" : "pointer",
            opacity: analyzing ? 0.6 : 1,
            width: "100%",
          }}
        >
          {analyzing
            ? "🔄 AI 分析中..."
            : `🎯 分析 ${selectedSymbol} 并获取交易建议`}
        </button>
      </div>

      {/* 交易建议历史 */}
      <div>
        <h3 style={{ fontSize: "16px", marginBottom: "10px" }}>
          💡 交易建议历史
        </h3>
        <div
          style={{
            maxHeight: "400px",
            overflowY: "auto",
            border: "1px solid #ddd",
            borderRadius: "8px",
          }}
        >
          {tradingAdvices.length === 0 ? (
            <div
              style={{
                padding: "20px",
                textAlign: "center",
                color: "#666",
                fontStyle: "italic",
              }}
            >
              暂无交易建议，请选择交易对并点击"分析"按钮
            </div>
          ) : (
            tradingAdvices.map((advice, i) => (
              <div
                key={i}
                style={{
                  padding: "15px",
                  borderBottom:
                    i < tradingAdvices.length - 1 ? "1px solid #eee" : "none",
                  background: i === 0 ? "#f8f9fa" : "white",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "10px",
                  }}
                >
                  <div>
                    <span
                      style={{
                        fontSize: "16px",
                        fontWeight: "bold",
                        color: "#007bff",
                      }}
                    >
                      {advice.symbol}
                    </span>
                    <span
                      style={{
                        marginLeft: "10px",
                        fontSize: "14px",
                        color: "#666",
                      }}
                    >
                      ${parseFloat(advice.currentPrice).toLocaleString()}
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                    }}
                  >
                    <span style={{ fontSize: "12px", color: "#999" }}>
                      {new Date(advice.timestamp).toLocaleString()}
                    </span>
                    {advice.id && (
                      <span
                        style={{
                          fontSize: "12px",
                          padding: "3px 8px",
                          borderRadius: "12px",
                          background: advice.verifyError
                            ? "#dc3545"
                            : advice.verified
                            ? "#28a745"
                            : verifyingAdviceId === advice.id
                            ? "#ffc107"
                            : "#6c757d",
                          color: "white",
                        }}
                      >
                        {advice.verifyError
                          ? "❌ 验证失败"
                          : advice.verified
                          ? "✓ 已验证"
                          : verifyingAdviceId === advice.id
                          ? "⏳ 验证中"
                          : "⚠️ 未验证"}
                      </span>
                    )}
                  </div>
                </div>
                <div
                  style={{
                    fontSize: "14px",
                    lineHeight: "1.6",
                    color: "#333",
                    whiteSpace: "pre-wrap",
                    background: "#f8f9fa",
                    padding: "10px",
                    borderRadius: "4px",
                  }}
                >
                  {advice.advice}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 风险提示 */}
      <div
        style={{
          marginTop: "20px",
          padding: "10px",
          background: "#fff3cd",
          border: "1px solid #ffc107",
          borderRadius: "4px",
          fontSize: "12px",
          color: "#856404",
        }}
      >
        ⚠️ <strong>风险提示：</strong>
        本交易建议由 AI
        生成，仅供参考。加密货币交易具有高风险，请谨慎决策，自负盈亏。
      </div>
    </div>
  );
}
