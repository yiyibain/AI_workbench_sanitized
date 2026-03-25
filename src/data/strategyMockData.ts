import { MarketDataPoint, Opportunity, ReasonDimension, StrategyProposal } from '../types/strategy';

// 模拟市场数据（Mekko图表用）
// 使用通用列名 A/B/C，避免真实业务语义
export const mockMarketData: MarketDataPoint[] = [
  { id: '1', A: 'A1', B: 'B1', C: 'C1', dimension1: 'A1', dimension2: 'B1', value: 28, companyShare: 22, competitorShare: 46, growthRate: 2.1, province: 'P1' },
  { id: '2', A: 'A1', B: 'B2', C: 'C1', dimension1: 'A1', dimension2: 'B2', value: 16, companyShare: 12, competitorShare: 57, growthRate: 1.4, province: 'P1' },
  { id: '3', A: 'A1', B: 'B3', C: 'C2', dimension1: 'A1', dimension2: 'B3', value: 11, companyShare: 9, competitorShare: 63, growthRate: 0.3, province: 'P2' },
  { id: '4', A: 'A2', B: 'B1', C: 'C2', dimension1: 'A2', dimension2: 'B1', value: 23, companyShare: 17, competitorShare: 53, growthRate: 1.9, province: 'P2' },
  { id: '5', A: 'A2', B: 'B2', C: 'C2', dimension1: 'A2', dimension2: 'B2', value: 19, companyShare: 15, competitorShare: 58, growthRate: 0.8, province: 'P3' },
  { id: '6', A: 'A2', B: 'B3', C: 'C3', dimension1: 'A2', dimension2: 'B3', value: 13, companyShare: 8, competitorShare: 67, growthRate: -0.2, province: 'P3' },
  { id: '7', A: 'A3', B: 'B1', C: 'C3', dimension1: 'A3', dimension2: 'B1', value: 21, companyShare: 14, competitorShare: 60, growthRate: 2.5, province: 'P4' },
  { id: '8', A: 'A3', B: 'B2', C: 'C1', dimension1: 'A3', dimension2: 'B2', value: 14, companyShare: 10, competitorShare: 64, growthRate: 1.1, province: 'P4' },
  { id: '9', A: 'A3', B: 'B3', C: 'C3', dimension1: 'A3', dimension2: 'B3', value: 9, companyShare: 6, competitorShare: 71, growthRate: -0.6, province: 'P5' },
];

export const mockDimensionConfigs = [
  { key: 'A', label: 'A', type: 'channel', isAvailableForAxis: true },
  { key: 'B', label: 'B', type: 'department', isAvailableForAxis: true },
  { key: 'C', label: 'C', type: 'brand', isAvailableForAxis: true },
] as const;

// 模拟机会点
export const mockOpportunities: Opportunity[] = [
  {
    id: 'opp1',
    title: 'A1-B2 细分机会',
    description: 'A1-B2 分组在关键指标上低于同层均值，存在优化空间',
    marketSegment: 'A1-B2',
    currentGap: 'A1-B2 分组份额表现偏弱，且增长率低于 A1 其他分组',
    potential: 'high',
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-15'),
  },
  {
    id: 'opp2',
    title: 'A3-B3 细分机会',
    description: 'A3-B3 增长为负，且竞品份额持续扩大',
    marketSegment: 'A3-B3',
    currentGap: 'A3-B3 分组出现连续下滑，需重新分配资源和动作',
    potential: 'high',
    createdAt: new Date('2024-01-16'),
    updatedAt: new Date('2024-01-16'),
  },
  {
    id: 'opp3',
    title: 'Tier2 产品组机会',
    description: 'Tier2 产品组当前贡献较低，但在 C3 维度有可挖潜空间',
    marketSegment: 'Tier2-C3',
    currentGap: 'Tier2 在 C3 的覆盖与转化低于整体均值',
    potential: 'high',
    createdAt: new Date('2024-01-17'),
    updatedAt: new Date('2024-01-17'),
  },
];

// 预置原因维度
export const defaultReasonDimensions: ReasonDimension[] = [
  {
    id: 'rd5',
    name: '环境因素',
    category: 'other',
    description: '渠道准入、政策变化、竞争环境等',
  },
  {
    id: 'rd1',
    name: '产品因素',
    category: 'product',
    description: '产品特性、适应症、价格竞争力等',
  },
  {
    id: 'rd2',
    name: '商业推广因素',
    category: 'businessModel',
    description: '渠道策略、定价策略、推广模式等',
  },
  {
    id: 'rd3',
    name: '资源分配因素',
    category: 'resource',
    description: '人力投入、市场投入、资源配置等',
  },
];

// 模拟策略建议
export const mockStrategyProposals: StrategyProposal[] = [
  {
    id: 'sp1',
    title: '提升 A1 维度份额',
    description: '通过强化渠道协同和触点覆盖，提升 A1 维度的整体份额',
    opportunityId: 'opp1',
    priority: 1,
    status: 'draft',
    actions: [
      '优化 A1-B2 的资源投放节奏',
      '提升 C1 维度的渠道覆盖效率',
      '建立分组复盘机制并按月追踪',
    ],
    expectedOutcome: 'A1 维度份额提升 3-5 个百分点',
    createdAt: new Date('2024-01-20'),
    updatedAt: new Date('2024-01-20'),
    isFromAI: true,
  },
  {
    id: 'sp2',
    title: '提升 B3 维度表现',
    description: '围绕 B3 分组设计专项动作，提升该分组增长质量',
    opportunityId: 'opp2',
    priority: 2,
    status: 'draft',
    actions: [
      '对 B3 维度建立阶段性目标',
      '针对 C3 维度优化渠道触达策略',
      '按周监测关键指标并快速调整',
    ],
    expectedOutcome: 'B3 维度由负增长转为正增长',
    createdAt: new Date('2024-01-21'),
    updatedAt: new Date('2024-01-21'),
    isFromAI: true,
  },
];

// 维度选项
export const dimensionOptions = {
  channel: ['A1', 'A2', 'A3'],
  department: ['B1', 'B2', 'B3'],
  brand: ['产品1', '产品2', '产品3', '产品4', '产品5', '产品6'],
  province: ['P1', 'P2', 'P3', 'P4', 'P5'],
};

