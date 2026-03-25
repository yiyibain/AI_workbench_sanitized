import * as XLSX from 'xlsx';
import { MarketDataPoint, DimensionConfig } from '../types/strategy';

/**
 * 读取Excel文件并提取数据
 * @param filePath 文件路径
 * @param filterByValue 是否只保留value > 0的数据（默认true，对于数据库文件应设为false）
 */
export async function readExcelFile(filePath: string, filterByValue: boolean = true): Promise<{
  data: MarketDataPoint[];
  columns: string[];
  dimensionConfigs: DimensionConfig[];
}> {
  try {
    console.log('🔍 开始获取Excel文件:', filePath);
    const response = await fetch(filePath);
    
    // 检查响应状态
    if (!response.ok) {
      const errorText = await response.text().catch(() => '无法读取错误信息');
      throw new Error(`HTTP错误 ${response.status}: ${response.statusText}. 响应内容: ${errorText.substring(0, 200)}`);
    }
    
    // 检查Content-Type
    const contentType = response.headers.get('content-type');
    console.log('📄 响应Content-Type:', contentType);
    
    // 如果Content-Type是HTML，说明可能是404页面，先检查
    if (contentType && contentType.includes('text/html')) {
      const text = await response.clone().text().catch(() => '');
      if (text.includes('404') || text.includes('Not Found') || text.includes('Cannot GET')) {
        throw new Error(`文件未找到: ${filePath}。请确保文件存在于public目录中，且路径正确。`);
      }
      throw new Error(`服务器返回了HTML而不是Excel文件: ${filePath}。Content-Type: ${contentType}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    console.log('📦 获取到的文件大小:', arrayBuffer.byteLength, 'bytes');
    
    if (arrayBuffer.byteLength === 0) {
      throw new Error('Excel文件大小为0，文件可能不存在或为空');
    }
    
    // 验证文件头是否为Excel格式（XLSX文件以PK开头，因为它是ZIP格式）
    const uint8Array = new Uint8Array(arrayBuffer.slice(0, 4));
    const fileSignature = Array.from(uint8Array).map(b => String.fromCharCode(b)).join('');
    if (fileSignature !== 'PK\x03\x04' && fileSignature !== 'PK\x05\x06') {
      console.warn('⚠️ 文件签名不匹配，可能不是有效的Excel文件，但继续尝试读取...');
      console.log('文件签名:', Array.from(uint8Array).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
    }
    
    // 对于大文件（>50MB），XLSX 库可能需要使用 sheetRows 选项来加载数据
    // 先尝试使用 sheetRows 选项，限制读取的行数以避免内存问题
    // 注意：如果文件有23万行，可能需要调整这个值
    const fileSizeMB = arrayBuffer.byteLength / 1024 / 1024;
    console.log(`📊 文件大小: ${fileSizeMB.toFixed(2)}MB`);
    
    // 根据文件大小决定读取策略
    const readOptions: any = {
      type: 'array' as const,
      cellDates: false,
      cellNF: false,
      cellStyles: false,
    };
    
    // 不设置sheetRows限制，读取所有数据
    // 注意：对于非常大的文件（23万行），需要读取所有数据才能正确计算CAGR和增速
    // 如果设置sheetRows限制，会导致后面的数据（如2023年）无法读取
    // 因此不设置sheetRows，让XLSX读取所有行
    
    console.log('🔧 使用读取选项:', readOptions);
    
    let workbook = XLSX.read(arrayBuffer, readOptions);
    
    // 如果 Sheets 为空，尝试使用不同的方法
    if (!workbook.Sheets || Object.keys(workbook.Sheets).length === 0) {
      console.warn('⚠️ 第一次读取后 Sheets 为空，尝试使用备用方法...');
      
      // 方法1: 尝试使用默认选项（不设置任何选项）
      try {
        console.log('🔧 尝试方法1: 使用默认选项重新读取（无任何限制）...');
        workbook = XLSX.read(arrayBuffer);
        console.log('📋 方法1读取后的工作表键:', workbook.Sheets ? Object.keys(workbook.Sheets) : []);
        console.log('📋 方法1读取后的工作表数量:', workbook.SheetNames?.length || 0);
      } catch (err) {
        console.error('❌ 方法1失败:', err);
      }
      
      // 方法2: 如果还是为空，尝试使用 sheetRows 限制（对于大文件，可能需要限制）
      if (!workbook.Sheets || Object.keys(workbook.Sheets).length === 0) {
        console.warn('⚠️ 方法1仍然为空，尝试使用 sheetRows 选项（限制读取行数）...');
        try {
          // 先尝试读取前50000行（对于大文件，可能需要分批处理）
          workbook = XLSX.read(arrayBuffer, {
            type: 'array' as const,
            sheetRows: 50000,
          });
          console.log('📋 方法2使用 sheetRows=50000 后的工作表键:', workbook.Sheets ? Object.keys(workbook.Sheets) : []);
          
          // 如果还是为空，尝试更小的行数
          if (!workbook.Sheets || Object.keys(workbook.Sheets).length === 0) {
            console.warn('⚠️ 方法2仍然为空，尝试更小的行数...');
            workbook = XLSX.read(arrayBuffer, {
              type: 'array' as const,
              sheetRows: 1000,
            });
            console.log('📋 方法2使用 sheetRows=1000 后的工作表键:', workbook.Sheets ? Object.keys(workbook.Sheets) : []);
          }
        } catch (err) {
          console.error('❌ 方法2失败:', err);
        }
      }
      
      // 如果所有方法都失败，抛出详细错误
      if (!workbook.Sheets || Object.keys(workbook.Sheets).length === 0) {
        console.error('❌ 所有方法都失败，workbook 结构:', {
          hasSheetNames: !!workbook.SheetNames,
          sheetNamesCount: workbook.SheetNames?.length || 0,
          sheetNames: workbook.SheetNames,
          hasSheets: !!workbook.Sheets,
          sheetsKeys: workbook.Sheets ? Object.keys(workbook.Sheets) : [],
          workbookKeys: Object.keys(workbook),
        });
        throw new Error(`无法读取Excel工作表数据。文件可能过大（${(arrayBuffer.byteLength / 1024 / 1024).toFixed(2)}MB）或格式不正确。工作表名称: ${workbook.SheetNames?.join(', ') || '无'}`);
      }
    }
    console.log('📊 工作簿工作表数量:', workbook.SheetNames.length);
    console.log('📋 工作表名称:', workbook.SheetNames);
    console.log('📋 workbook.Sheets 对象的所有键:', Object.keys(workbook.Sheets || {}));
    console.log('📋 workbook 对象结构:', {
      hasSheetNames: !!workbook.SheetNames,
      hasSheets: !!workbook.Sheets,
      sheetNamesType: typeof workbook.SheetNames,
      sheetsType: typeof workbook.Sheets,
      sheetsIsArray: Array.isArray(workbook.Sheets),
      sheetsKeysCount: workbook.Sheets ? Object.keys(workbook.Sheets).length : 0
    });
    
    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      throw new Error('Excel文件不包含任何工作表');
    }
    
    // 读取第一个工作表
    const firstSheetName = workbook.SheetNames[0];
    console.log('🔍 尝试读取工作表:', firstSheetName);
    console.log('🔍 工作表名称类型:', typeof firstSheetName);
    console.log('🔍 工作表名称长度:', firstSheetName?.length);
    console.log('🔍 workbook.Sheets 中是否存在该键:', firstSheetName in (workbook.Sheets || {}));
    
    // 尝试多种方式获取工作表
    let worksheet = workbook.Sheets[firstSheetName];
    let actualSheetName = firstSheetName;
    
    // 如果直接访问失败，尝试遍历所有键
    if (!worksheet && workbook.Sheets) {
      console.log('⚠️ 直接访问失败，尝试查找匹配的工作表...');
      const allSheetKeys = Object.keys(workbook.Sheets);
      console.log('所有可用的工作表键:', allSheetKeys);
      console.log('请求的工作表名称:', JSON.stringify(firstSheetName));
      console.log('请求的工作表名称字符码:', Array.from(firstSheetName).map(c => c.charCodeAt(0)));
      
      // 尝试精确匹配
      for (const key of allSheetKeys) {
        console.log('比较键:', JSON.stringify(key), 'vs', JSON.stringify(firstSheetName), '匹配:', key === firstSheetName);
        if (key === firstSheetName) {
          worksheet = workbook.Sheets[key];
          actualSheetName = key;
          console.log('✅ 找到精确匹配的工作表:', key);
          break;
        }
      }
      
      // 如果精确匹配失败，尝试去除空格后匹配
      if (!worksheet) {
        const trimmedRequested = firstSheetName.trim();
        for (const key of allSheetKeys) {
          const trimmedKey = key.trim();
          if (trimmedKey === trimmedRequested) {
            worksheet = workbook.Sheets[key];
            actualSheetName = key;
            console.log('✅ 找到去除空格后匹配的工作表:', key);
            break;
          }
        }
      }
      
      // 如果还是找不到，使用第一个可用的工作表
      if (!worksheet && allSheetKeys.length > 0) {
        console.log('⚠️ 使用第一个可用的工作表:', allSheetKeys[0]);
        worksheet = workbook.Sheets[allSheetKeys[0]];
        actualSheetName = allSheetKeys[0];
        console.log('📝 实际使用的工作表名称:', actualSheetName);
      }
    }
    
    if (!worksheet) {
      console.error('❌ 无法读取工作表详情:', {
        requestedSheetName: firstSheetName,
        availableSheetNames: workbook.SheetNames,
        availableSheetKeys: workbook.Sheets ? Object.keys(workbook.Sheets) : [],
        workbookStructure: Object.keys(workbook)
      });
      throw new Error(`无法读取工作表: ${firstSheetName}。可用的工作表键: ${workbook.Sheets ? Object.keys(workbook.Sheets).join(', ') : '无'}`);
    }
    
    console.log('✅ 成功获取工作表对象:', {
      worksheetType: typeof worksheet,
      hasData: !!worksheet,
      worksheetKeys: worksheet ? Object.keys(worksheet).slice(0, 10) : []
    });
    
    // 转换为JSON格式
    // 使用 defval: null 确保空单元格被正确处理
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
      header: 1, 
      defval: null,
      raw: false 
    }) as any[][];
    
    console.log('📈 转换后的数据行数:', jsonData.length);
    console.log('📋 前3行数据示例:', jsonData.slice(0, 3));
    
    if (jsonData.length === 0) {
      // 尝试使用不同的方法读取
      console.warn('⚠️ 使用header:1方法未读取到数据，尝试使用其他方法...');
      const jsonDataAlt = XLSX.utils.sheet_to_json(worksheet, { 
        header: 'A',
        defval: null,
        raw: false 
      });
      console.log('📋 备用方法读取的数据行数:', Array.isArray(jsonDataAlt) ? jsonDataAlt.length : 0);
      
      if (Array.isArray(jsonDataAlt) && jsonDataAlt.length === 0) {
        throw new Error('Excel文件工作表为空，没有数据行。请检查文件格式是否正确。');
      } else if (Array.isArray(jsonDataAlt) && jsonDataAlt.length > 0) {
        // 如果备用方法有数据，说明文件格式可能不同，需要特殊处理
        throw new Error('Excel文件格式异常，请确保文件是标准的Excel格式且第一行包含目录准入。');
      }
      throw new Error('Excel文件工作表为空，没有数据行');
    }
    
    // 检查是否有表头
    if (jsonData.length === 1) {
      console.warn('⚠️ Excel文件只有表头行，没有数据行');
    }
    
    // 第一行是目录准入
    const headers = jsonData[0] as string[];
    
    // 检查表头是否有效
    if (!headers || headers.length === 0) {
      throw new Error('Excel文件第一行（表头）为空，请确保第一行包含目录准入');
    }
    
    console.log('📝 表头信息:', {
      列数: headers.length,
      前5列: headers.slice(0, 5),
      所有列: headers
    });
    
    // 清理和标准化目录准入
    const cleanedHeaders = headers.map((h, idx) => {
      if (!h || h === '') return `列${idx + 1}`;
      return String(h).trim();
    });
    
    console.log('Excel文件目录准入:', cleanedHeaders);
    
    // 指标列（需要排除，不作为维度）
    const metricColumns: string[] = [
      '金额', '盒', '片', 'pdot', 'value', '市场份额', '销售额', 
      'sales', 'market share', '销量', '数量', 'amount', 'quantity',
      'companyShare', '某医药公司份额', 'competitorShare', '竞品份额',
      'growthRate', '增长率', 'growth', '增速'
    ];
    
    // 提取维度列（排除指标列和ID列）
    const dimensionColumns: string[] = [];
    cleanedHeaders.forEach((header) => {
      if (!header || header === '') return;
      
      const headerLower = header.toLowerCase().trim();
      const isMetric = metricColumns.some(m => headerLower.includes(m.toLowerCase()));
      const isId = headerLower === 'id' || headerLower === '序号' || headerLower === '编号' || headerLower === 'sku';
      
      // 排除以"_英文"结尾的列（这些通常是重复的英文列）
      const isEnglishColumn = header.endsWith('_英文') || header.endsWith('_English');
      
      if (!isMetric && !isId && !isEnglishColumn) {
        dimensionColumns.push(header);
      }
    });
    
    console.log('提取的维度列:', dimensionColumns);
    
    // 创建维度配置
    const dimensionConfigs: DimensionConfig[] = dimensionColumns.map((col, idx) => ({
      key: `dimension${idx + 1}`,
      label: col,
      type: inferDimensionType(col),
      isAvailableForAxis: true,
    }));
    
    // 转换数据
    const data: MarketDataPoint[] = [];
    for (let i = 1; i < jsonData.length; i++) {
      const row = jsonData[i];
      if (!row || row.length === 0) continue;
      
      const dataPoint: any = {
        id: `row-${i}`,
      };
      
      // 映射目录准入到数据点
      cleanedHeaders.forEach((header, colIndex) => {
        const value = row[colIndex];
        if (value === undefined || value === null || value === '') return;
        
        const headerLower = header?.toLowerCase() || '';
        
        // 特殊字段处理
        if (headerLower === 'id' || headerLower === '序号' || headerLower === '编号') {
          dataPoint.id = String(value);
        } else if (headerLower.includes('province') || headerLower.includes('省份') || headerLower.includes('地区') || headerLower.includes('区域')) {
          dataPoint.province = String(value);
        } else {
          // 维度字段：找到对应的维度索引
          const dimIndex = dimensionColumns.indexOf(header);
          if (dimIndex >= 0) {
            dataPoint[`dimension${dimIndex + 1}`] = String(value);
          }
        }
      });
      
      // 优先使用pdot列作为value（用于计算市场份额）
      const pdotIndex = cleanedHeaders.findIndex(h => 
        h?.toLowerCase().trim() === 'pdot'
      );
      
      if (pdotIndex >= 0 && row[pdotIndex] !== undefined && row[pdotIndex] !== null && row[pdotIndex] !== '') {
        // 使用pdot列的值
        const pdotValue = typeof row[pdotIndex] === 'number' 
          ? row[pdotIndex] 
          : parseFloat(String(row[pdotIndex]).replace(/,/g, '')) || 0;
        dataPoint.value = pdotValue;
      } else {
        // 如果没有pdot列，回退到金额、amount或value列
        const amountIndex = cleanedHeaders.findIndex(h => {
          const hLower = h?.toLowerCase() || '';
          return hLower.includes('金额') || hLower.includes('amount') || hLower.includes('value');
        });
        
        if (amountIndex >= 0 && row[amountIndex] !== undefined && row[amountIndex] !== null && row[amountIndex] !== '') {
          const numValue = typeof row[amountIndex] === 'number' 
            ? row[amountIndex] 
            : parseFloat(String(row[amountIndex]).replace(/,/g, '')) || 0;
          dataPoint.value = numValue;
        } else {
          dataPoint.value = 0;
        }
      }
      
      // 根据参数决定是否过滤value=0的数据
      // 对于数据库文件（如全国及分省分销.xlsx），不过滤，因为可能包含WD等指标数据
      if (!filterByValue || dataPoint.value > 0) {
        data.push(dataPoint as MarketDataPoint);
      }
    }
    
    console.log(`成功读取 ${data.length} 条数据，${dimensionConfigs.length} 个维度`);
    console.log('维度配置:', dimensionConfigs.map(d => `${d.label} (${d.key})`));
    
    return {
      data,
      columns: cleanedHeaders,
      dimensionConfigs,
    };
  } catch (error) {
    console.error('❌ 读取Excel文件失败:', error);
    if (error instanceof Error) {
      console.error('错误详情:', {
        消息: error.message,
        堆栈: error.stack,
        文件路径: filePath
      });
      // 提供更友好的错误信息
      if (error.message.includes('HTTP错误')) {
        throw new Error(`无法加载Excel文件: ${filePath}。请确保文件存在于public目录中。${error.message}`);
      } else if (error.message.includes('为空')) {
        throw new Error(`Excel文件为空或格式不正确: ${filePath}。${error.message}`);
      } else {
        throw new Error(`读取Excel文件时出错: ${error.message}`);
      }
    }
    throw error;
  }
}

/**
 * 推断维度类型
 */
function inferDimensionType(columnName: string): 'channel' | 'department' | 'brand' | 'province' | 'molecule' | 'class' | 'priceBand' {
  const lower = columnName.toLowerCase();
  
  if (lower.includes('渠道') || lower.includes('channel') || lower.includes('医院') || lower.includes('零售') || lower.includes('电商') || lower.includes('店铺') || lower.includes('平台')) {
    return 'channel';
  }
  if (lower.includes('科室') || lower.includes('department') || lower.includes('科')) {
    return 'department';
  }
  if (lower.includes('品牌') || lower.includes('brand')) {
    return 'brand';
  }
  if (lower.includes('省份') || lower.includes('province') || lower.includes('地区') || lower.includes('区域')) {
    return 'province';
  }
  if (lower.includes('分子') || lower.includes('molecule') || lower.includes('活性成分') || lower.includes('通用名')) {
    return 'molecule';
  }
  if (lower.includes('类别') || lower.includes('class') || lower.includes('类型')) {
    return 'class';
  }
  if (lower.includes('价格') || lower.includes('price')) {
    return 'priceBand';
  }
  
  // 默认返回channel
  return 'channel';
}

