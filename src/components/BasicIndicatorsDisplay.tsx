import { useState, useEffect, useRef } from 'react';
import { BasicIndicators, ProductPerformance, AIAnalysis } from '../types';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp, TrendingDown, Minus, MessageCircle } from 'lucide-react';
import DataInterpretation from './DataInterpretation';
import { useAnalysis } from '../contexts/AnalysisContext';
import { analyzeProductPerformance } from '../services/aiService';
import InlineAIChat from './InlineAIChat';

interface BasicIndicatorsDisplayProps {
  indicators: BasicIndicators;
  product: ProductPerformance;
}

export default function BasicIndicatorsDisplay({ indicators, product }: BasicIndicatorsDisplayProps) {
  const [selectedCategory, setSelectedCategory] = useState<'result' | 'process'>('result');
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const {
    getCachedAnalysis,
    setCachedAnalysis,
  } = useAnalysis();

  // 追问功能相关状态
  const [selectedText, setSelectedText] = useState<string>('');
  const [showChatButton, setShowChatButton] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [chatPosition, setChatPosition] = useState<{ top: number; left: number } | null>(null);
  const selectionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearStatusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedTextRef = useRef<string>('');
  const containerRef = useRef<HTMLDivElement>(null);
  const indicatorsSectionRef = useRef<HTMLDivElement>(null);

  // 生成缓存键
  const cacheKey = `product-${product.productId}-${product.period}`;

  useEffect(() => {
    loadAnalysis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.productId, product.period]);

  const loadAnalysis = async () => {
    // 检查缓存
    const cached = getCachedAnalysis(cacheKey);
    if (cached) {
      setAnalysis(cached);
      return;
    }

    // 需要重新分析
    setLoading(true);
    try {
      const result = await analyzeProductPerformance(product, indicators);
      setAnalysis(result);
      // 保存到缓存
      setCachedAnalysis(cacheKey, result);
    } catch (error) {
      console.error('Failed to load analysis:', error);
    } finally {
      setLoading(false);
    }
  };

  // 结果指标数据
  const resultIndicatorData = indicators.quarterlyData.map((q, index) => {
    const prevValue = index > 0 ? indicators.quarterlyData[index - 1].statinShare : q.statinShare;
    const change = q.statinShare - prevValue;
    return {
      period: q.period,
      value: q.statinShare,
      change,
      baseline: 10, // 基准值：通常在10%左右浮动
    };
  });

  // 过程指标数据
  const processIndicatorsData = indicators.quarterlyData.map((q, index) => {
    const prevCore = index > 0 ? indicators.quarterlyData[index - 1].coreHospitalPenetration : q.coreHospitalPenetration;
    const prevStable = index > 0 ? indicators.quarterlyData[index - 1].stableDistributionRate : q.stableDistributionRate;
    const prevWeighted = index > 0 ? indicators.quarterlyData[index - 1].weightedDeLimitRate : q.weightedDeLimitRate;
    const prevTarget = index > 0 ? indicators.quarterlyData[index - 1].targetHospitalPenetration : q.targetHospitalPenetration;
    
    return {
      period: q.period,
      渠道1份额: q.coreHospitalPenetration,
      稳定分销率: q.stableDistributionRate,
      渠道3覆盖率: q.weightedDeLimitRate,
      核心渠道份额: q.targetHospitalPenetration,
      // 变化量
      coreChange: q.coreHospitalPenetration - prevCore,
      stableChange: q.stableDistributionRate - prevStable,
      weightedChange: q.weightedDeLimitRate - prevWeighted,
      targetChange: q.targetHospitalPenetration - prevTarget,
      // 基准值
      coreBaseline: 10,
      stableBaseline: 60,
      weightedBaseline: 20,
      targetBaseline: 10,
    };
  });

  // 计算平均值和趋势
  const calculateStats = (data: typeof resultIndicatorData) => {
    const values = data.map(d => d.value);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const latest = values[values.length - 1];
    const previous = values.length > 1 ? values[values.length - 2] : latest;
    const trend = latest > previous ? 'up' : latest < previous ? 'down' : 'stable';
    return { avg, latest, trend };
  };

  const resultStats = calculateStats(resultIndicatorData);

  // 处理文本选择（防抖处理，避免频繁更新）
  const handleTextSelection = () => {
    if (selectionTimeoutRef.current) {
      clearTimeout(selectionTimeoutRef.current);
    }
    
    selectionTimeoutRef.current = setTimeout(() => {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0 && selection.toString().trim().length > 0) {
        const selected = selection.toString().trim();
        // 只处理长度大于3的选中文本
        if (selected.length < 3) {
          setSelectedText('');
          setShowChatButton(false);
          return;
        }
        
        const range = selection.getRangeAt(0);
        let commonAncestor: Node = range.commonAncestorContainer;
        
        // 如果commonAncestor是文本节点，获取其父元素
        if (commonAncestor.nodeType === Node.TEXT_NODE) {
          commonAncestor = commonAncestor.parentNode as Node;
        }
        
        // 检查是否在容器内（包括基础指标展示区域）
        if (containerRef.current && containerRef.current.contains(commonAncestor as Node)) {
          setSelectedText(selected);
          selectedTextRef.current = selected;
          setShowChatButton(true);
        } else {
          setSelectedText('');
          selectedTextRef.current = '';
          setShowChatButton(false);
        }
      } else {
        // 如果没有选中文本，延迟清除状态
        if (clearStatusTimeoutRef.current) {
          clearTimeout(clearStatusTimeoutRef.current);
        }
        clearStatusTimeoutRef.current = setTimeout(() => {
          const currentSelection = window.getSelection();
          if (!currentSelection || currentSelection.toString().trim().length === 0) {
            if (!showChat) {
              setSelectedText('');
              selectedTextRef.current = '';
              setShowChatButton(false);
            }
          }
        }, 200);
      }
    }, 150); // 防抖时间150ms
  };

  // 处理点击追问按钮
  const handleAskQuestion = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation(); // 阻止事件冒泡
      e.preventDefault(); // 阻止默认行为
    }
    
    // 清除可能存在的清除状态的定时器
    if (clearStatusTimeoutRef.current) {
      clearTimeout(clearStatusTimeoutRef.current);
    }
    
    const textToUse = selectedText || selectedTextRef.current;
    if (!textToUse) {
      return;
    }
    
    // 如果selectedText为空但ref有值，更新state
    if (!selectedText && textToUse) {
      setSelectedText(textToUse);
    }
    
    // 固定在右上角，位于按钮下方
    setChatPosition({
      top: 80, // 距离顶部80px (按钮top-4是16px，加上按钮高度和间距)
      left: Math.max(20, window.innerWidth - 420), // 距离右侧420px，但至少距离左边20px
    });
    setShowChat(true);
  };

  // 处理鼠标抬起事件（用于文本选择）
  const handleMouseUp = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    // 如果点击在对话框内，不处理文本选择
    const chatPanel = target.closest('[data-ai-chat-panel="true"]');
    if (chatPanel) {
      return;
    }
    // 如果点击的是按钮，不处理文本选择
    if (target.closest('button')) {
      return;
    }
    // 延迟处理，确保文本选择完成
    setTimeout(() => {
      handleTextSelection();
    }, 50);
  };

  // 设置文本选择监听
  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      // 使用selectionchange事件，更可靠地检测文本选择
      const handleSelectionChange = () => {
        // 检查选择是否在容器内
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          const commonAncestor = range.commonAncestorContainer;
          // 只有在容器内的选择才处理
          if (container.contains(commonAncestor as Node)) {
            handleTextSelection();
          }
        } else {
          // 选择被清空，延迟清除状态
          if (clearStatusTimeoutRef.current) {
            clearTimeout(clearStatusTimeoutRef.current);
          }
          clearStatusTimeoutRef.current = setTimeout(() => {
            const currentSelection = window.getSelection();
            if (!currentSelection || currentSelection.toString().trim().length === 0) {
              if (!showChat) {
                setSelectedText('');
                selectedTextRef.current = '';
                setShowChatButton(false);
              }
            }
          }, 200);
        }
      };
      
      // 同时监听mouseup和selectionchange
      container.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('selectionchange', handleSelectionChange);
      
      // 点击外部区域时清除选择（延迟执行，避免与文本选择冲突）
      const handleClickOutside = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        
        // 如果点击的是追问按钮，不清除选择
        if (target.closest('button') && target.closest('button')?.textContent?.includes('追问')) {
          return;
        }
        
        // 如果点击的是AI对话面板内的任何元素，不清除选择
        const chatPanel = target.closest('[data-ai-chat-panel="true"]');
        if (chatPanel) {
          e.stopPropagation();
          return;
        }
        
        // 如果对话框已打开，点击对话框外部也不清除
        if (showChat) {
          return;
        }
        
        // 延迟清除，确保文本选择事件先处理
        if (clearStatusTimeoutRef.current) {
          clearTimeout(clearStatusTimeoutRef.current);
        }
        clearStatusTimeoutRef.current = setTimeout(() => {
          const selection = window.getSelection();
          const selectedText = selection?.toString().trim() || '';
          
          // 如果点击在容器外部，或者没有选中文本，则清除
          if (container && !container.contains(e.target as Node)) {
            if (selectedText.length === 0) {
              setSelectedText('');
              selectedTextRef.current = '';
              setShowChatButton(false);
              setShowChat(false);
              if (selection) {
                selection.removeAllRanges();
              }
            }
          } else if (selectedText.length === 0) {
            // 在容器内但文本选择被清空
            setSelectedText('');
            selectedTextRef.current = '';
            setShowChatButton(false);
          }
        }, 500);
      };
      
      document.addEventListener('mousedown', handleClickOutside);
      
      return () => {
        container.removeEventListener('mouseup', handleMouseUp);
        document.removeEventListener('selectionchange', handleSelectionChange);
        document.removeEventListener('mousedown', handleClickOutside);
        if (selectionTimeoutRef.current) {
          clearTimeout(selectionTimeoutRef.current);
        }
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showChat]);

  return (
    <div ref={containerRef} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 relative">
      {/* 使用提示 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
        <p className="text-sm text-blue-700 flex items-center">
          <MessageCircle className="w-4 h-4 mr-2" />
          <span>💡 提示：选中任意文本后，可点击"追问"按钮进行AI深度分析</span>
        </p>
      </div>

      {/* 追问按钮 - 显示在页面最右上角 */}
      {showChatButton && selectedText && (
        <div 
          className="fixed top-4 right-4 z-50"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
        >
          <button
            onClick={handleAskQuestion}
            onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
            className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 transition-colors shadow-lg animate-pulse"
          >
            <MessageCircle className="w-4 h-4" />
            <span>追问选中内容</span>
          </button>
        </div>
      )}

      {/* 标题 */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">基础指标展示</h2>
        <p className="text-sm text-gray-500">
          {indicators.productName} - 过往4个季度核心结果和过程指标
        </p>
      </div>

      {/* 指标分类切换 */}
      <div className="mb-6">
        <div className="flex space-x-2 border-b border-gray-200">
          <button
            onClick={() => setSelectedCategory('result')}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
              selectedCategory === 'result'
                ? 'border-primary-600 text-primary-700'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            结果指标
          </button>
          <button
            onClick={() => setSelectedCategory('process')}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
              selectedCategory === 'process'
                ? 'border-primary-600 text-primary-700'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            过程指标
          </button>
        </div>
      </div>

      {/* 结果指标展示 */}
      {selectedCategory === 'result' && (
        <div ref={indicatorsSectionRef} className="space-y-6 relative">
          {/* 结果指标概览卡片 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <div className="text-xs text-blue-600 mb-1">产品1占相关分子式份额</div>
              <div className="text-2xl font-bold text-blue-900 mb-2">
                {resultStats.latest.toFixed(1)}%
              </div>
              <div className="flex items-center text-sm">
                {resultStats.trend === 'up' && <TrendingUp className="w-4 h-4 text-green-600 mr-1" />}
                {resultStats.trend === 'down' && <TrendingDown className="w-4 h-4 text-red-600 mr-1" />}
                {resultStats.trend === 'stable' && <Minus className="w-4 h-4 text-gray-600 mr-1" />}
                <span className={resultStats.trend === 'up' ? 'text-green-600' : resultStats.trend === 'down' ? 'text-red-600' : 'text-gray-600'}>
                  {resultStats.trend === 'up' ? '上升' : resultStats.trend === 'down' ? '下降' : '稳定'}
                </span>
                <span className="text-gray-500 ml-2">vs 上季度</span>
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <div className="text-xs text-gray-600 mb-1">4季度平均值</div>
              <div className="text-2xl font-bold text-gray-900 mb-2">
                {resultStats.avg.toFixed(1)}%
              </div>
              <div className="text-sm text-gray-500">基准范围: 10%左右</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <div className="text-xs text-gray-600 mb-1">最新变化</div>
              <div className={`text-2xl font-bold mb-2 ${
                resultIndicatorData[resultIndicatorData.length - 1].change > 0 
                  ? 'text-green-600' 
                  : resultIndicatorData[resultIndicatorData.length - 1].change < 0 
                  ? 'text-red-600' 
                  : 'text-gray-900'
              }`}>
                {resultIndicatorData[resultIndicatorData.length - 1].change > 0 ? '+' : ''}
                {resultIndicatorData[resultIndicatorData.length - 1].change.toFixed(1)}%
              </div>
              <div className="text-sm text-gray-500">vs 上季度</div>
            </div>
          </div>

          {/* 结果指标趋势图 */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">产品1占相关分子式份额趋势</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={resultIndicatorData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip 
                  formatter={(value: number) => [`${value.toFixed(1)}%`, '份额']}
                  labelFormatter={(label) => `季度: ${label}`}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="value" 
                  stroke="#3b82f6" 
                  strokeWidth={2}
                  name="产品1占相关分子式份额"
                  dot={{ r: 5 }}
                  activeDot={{ r: 7 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="baseline" 
                  stroke="#94a3b8" 
                  strokeWidth={1}
                  strokeDasharray="5 5"
                  name="基准值 (10%)"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* 季度数据表格 */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">季度数据明细</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-300">
                    <th className="text-left py-2 px-4 font-semibold text-gray-700">季度</th>
                    <th className="text-right py-2 px-4 font-semibold text-gray-700">份额 (%)</th>
                    <th className="text-right py-2 px-4 font-semibold text-gray-700">变化 (%)</th>
                    <th className="text-right py-2 px-4 font-semibold text-gray-700">与基准差值</th>
                  </tr>
                </thead>
                <tbody>
                  {resultIndicatorData.map((item, index) => {
                    const diffFromBaseline = item.value - item.baseline;
                    return (
                      <tr key={index} className="border-b border-gray-200 hover:bg-gray-100">
                        <td className="py-2 px-4 text-gray-900">{item.period}</td>
                        <td className="py-2 px-4 text-right font-medium text-gray-900">
                          {item.value.toFixed(1)}%
                        </td>
                        <td className={`py-2 px-4 text-right ${
                          item.change > 0 ? 'text-green-600' : item.change < 0 ? 'text-red-600' : 'text-gray-600'
                        }`}>
                          {item.change > 0 ? '+' : ''}{item.change.toFixed(1)}%
                        </td>
                        <td className={`py-2 px-4 text-right ${
                          diffFromBaseline > 0 ? 'text-green-600' : diffFromBaseline < 0 ? 'text-red-600' : 'text-gray-600'
                        }`}>
                          {diffFromBaseline > 0 ? '+' : ''}{diffFromBaseline.toFixed(1)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 过程指标展示 */}
      {selectedCategory === 'process' && (
        <div ref={indicatorsSectionRef} className="space-y-6 relative">
          {/* 过程指标概览卡片 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { 
                name: '渠道1份额', 
                key: 'coreHospitalPenetration' as const,
                baseline: 10,
                latest: processIndicatorsData[processIndicatorsData.length - 1].渠道1份额,
                change: processIndicatorsData[processIndicatorsData.length - 1].coreChange,
              },
              { 
                name: '稳定分销率', 
                key: 'stableDistributionRate' as const,
                baseline: 60,
                latest: processIndicatorsData[processIndicatorsData.length - 1].稳定分销率,
                change: processIndicatorsData[processIndicatorsData.length - 1].stableChange,
              },
              { 
                name: '渠道3覆盖率', 
                key: 'weightedDeLimitRate' as const,
                baseline: 20,
                latest: processIndicatorsData[processIndicatorsData.length - 1].渠道3覆盖率,
                change: processIndicatorsData[processIndicatorsData.length - 1].weightedChange,
              },
              { 
                name: '核心渠道份额', 
                key: 'targetHospitalPenetration' as const,
                baseline: 10,
                latest: processIndicatorsData[processIndicatorsData.length - 1].核心渠道份额,
                change: processIndicatorsData[processIndicatorsData.length - 1].targetChange,
              },
            ].map((indicator) => (
              <div key={indicator.key} className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                <div className="text-xs text-purple-600 mb-1">{indicator.name}</div>
                <div className="text-2xl font-bold text-purple-900 mb-2">
                  {indicator.latest.toFixed(1)}%
                </div>
                <div className="flex items-center text-sm mb-1">
                  {indicator.change > 0 && <TrendingUp className="w-4 h-4 text-green-600 mr-1" />}
                  {indicator.change < 0 && <TrendingDown className="w-4 h-4 text-red-600 mr-1" />}
                  {indicator.change === 0 && <Minus className="w-4 h-4 text-gray-600 mr-1" />}
                  <span className={indicator.change > 0 ? 'text-green-600' : indicator.change < 0 ? 'text-red-600' : 'text-gray-600'}>
                    {indicator.change > 0 ? '+' : ''}{indicator.change.toFixed(1)}%
                  </span>
                </div>
                <div className="text-xs text-gray-500">基准: {indicator.baseline}%左右</div>
              </div>
            ))}
          </div>

          {/* 过程指标趋势图 */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">过程指标趋势对比</h3>
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={processIndicatorsData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip 
                  formatter={(value: number) => [`${value.toFixed(1)}%`, '']}
                  labelFormatter={(label) => `季度: ${label}`}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="渠道1份额" 
                  stroke="#8b5cf6" 
                  strokeWidth={2}
                  name="渠道1份额"
                  dot={{ r: 4 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="稳定分销率" 
                  stroke="#06b6d4" 
                  strokeWidth={2}
                  name="稳定分销率"
                  dot={{ r: 4 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="渠道3覆盖率" 
                  stroke="#f59e0b" 
                  strokeWidth={2}
                  name="渠道3覆盖率"
                  dot={{ r: 4 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="核心渠道份额" 
                  stroke="#ec4899" 
                  strokeWidth={2}
                  name="核心渠道份额"
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* 过程指标数据表格 */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">季度数据明细</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-300">
                    <th className="text-left py-2 px-4 font-semibold text-gray-700">季度</th>
                    <th className="text-right py-2 px-4 font-semibold text-gray-700">渠道1份额</th>
                    <th className="text-right py-2 px-4 font-semibold text-gray-700">稳定分销率</th>
                    <th className="text-right py-2 px-4 font-semibold text-gray-700">渠道3覆盖率</th>
                    <th className="text-right py-2 px-4 font-semibold text-gray-700">核心渠道份额</th>
                  </tr>
                </thead>
                <tbody>
                  {processIndicatorsData.map((item, index) => (
                    <tr key={index} className="border-b border-gray-200 hover:bg-gray-100">
                      <td className="py-2 px-4 text-gray-900">{item.period}</td>
                      <td className="py-2 px-4 text-right font-medium text-gray-900">
                        {item.渠道1份额.toFixed(1)}%
                      </td>
                      <td className="py-2 px-4 text-right font-medium text-gray-900">
                        {item.稳定分销率.toFixed(1)}%
                      </td>
                      <td className="py-2 px-4 text-right font-medium text-gray-900">
                        {item.渠道3覆盖率.toFixed(1)}%
                      </td>
                      <td className="py-2 px-4 text-right font-medium text-gray-900">
                        {item.核心渠道份额.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 数据解读部分 */}
      <div className="mt-8 pt-8 border-t border-gray-200">
        <div className="mb-4">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">数据解读</h2>
          <p className="text-sm text-gray-500">
            基于具体数据下钻分析，识别异常值、深挖原因、提炼风险点并提供解决方案
          </p>
        </div>
        <DataInterpretation product={product} analysis={analysis} loading={loading} indicators={indicators} />
      </div>

      {/* 内联AI对话面板 */}
      {showChat && (selectedText || selectedTextRef.current) && chatPosition && (
        <InlineAIChat
          selectedText={selectedText || selectedTextRef.current}
          position={chatPosition}
          context={{ product, analysis, indicators }}
          onClose={() => {
            setShowChat(false);
            setSelectedText('');
            selectedTextRef.current = '';
            setShowChatButton(false);
            setChatPosition(null);
            // 清空选择
            window.getSelection()?.removeAllRanges();
          }}
        />
      )}
    </div>
  );
}

