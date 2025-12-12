

import React from 'react';
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { ChartDataPoint } from '../types';

interface PriceChartProps {
  data: ChartDataPoint[];
  dataKey: 'price1' | 'price2' | 'ratio';
  syncId?: string;
  color?: string;
  showMa100?: boolean;
  showMa200?: boolean;
  label?: string;
}

const CustomTooltip = ({ active, payload, label, labelText }: any) => {
  if (active && payload && payload.length) {
    // payload[0] is usually the Area (price), others are MA lines
    const pricePayload = payload.find((p: any) => p.dataKey === 'price1' || p.dataKey === 'price2' || p.dataKey === 'ratio');
    const ma100Payload = payload.find((p: any) => p.dataKey?.startsWith('ma100_'));
    const ma200Payload = payload.find((p: any) => p.dataKey?.startsWith('ma200_'));

    const priceValue = pricePayload ? pricePayload.value : 0;
    const ma100Value = ma100Payload ? ma100Payload.value : null;
    const ma200Value = ma200Payload ? ma200Payload.value : null;

    const calcDiff = (price: number, ma: number) => ((price - ma) / ma) * 100;

    const diff100 = (priceValue && ma100Value) ? calcDiff(priceValue, ma100Value) : null;
    const diff200 = (priceValue && ma200Value) ? calcDiff(priceValue, ma200Value) : null;
    
    // Formatting helper
    const fmt = (val: number) => {
        if (Math.abs(val) < 1 && val !== 0) return val.toFixed(4);
        return new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 0 }).format(val);
    };

    return (
      <div className="bg-slate-800 border border-slate-700 p-3 rounded shadow-lg text-sm text-right min-w-[180px]" dir="rtl">
        <p className="text-slate-400 mb-2 border-b border-slate-700 pb-1">{label}</p>
        
        <div className="flex justify-between items-center gap-4 mb-2">
          <span className="text-emerald-400 font-medium">{labelText}:</span>
          <span className="font-bold text-white">
            {fmt(priceValue)}
          </span>
        </div>

        {/* MA100 Info */}
        {ma100Value && (
          <div className="mb-2 bg-slate-700/30 p-2 rounded">
            <div className="flex justify-between items-center gap-4 mb-1">
              <span className="text-purple-400 text-xs font-bold">MA100:</span>
              <span className="font-bold text-slate-200 text-xs">
                {fmt(ma100Value)}
              </span>
            </div>
            <div className="flex justify-between items-center gap-4">
              <span className="text-slate-500 text-[10px]">فاصله:</span>
              <span className={`font-bold text-xs ${diff100 && diff100 > 0 ? 'text-green-400' : 'text-red-400'}`} dir="ltr">
                {diff100 ? `${diff100 > 0 ? '+' : ''}${diff100.toFixed(2)}%` : '-'}
              </span>
            </div>
          </div>
        )}

        {/* MA200 Info */}
        {ma200Value && (
          <div className="bg-slate-700/30 p-2 rounded">
            <div className="flex justify-between items-center gap-4 mb-1">
              <span className="text-orange-400 text-xs font-bold">MA200:</span>
              <span className="font-bold text-slate-200 text-xs">
                {fmt(ma200Value)}
              </span>
            </div>
            <div className="flex justify-between items-center gap-4">
              <span className="text-slate-500 text-[10px]">فاصله:</span>
              <span className={`font-bold text-xs ${diff200 && diff200 > 0 ? 'text-green-400' : 'text-red-400'}`} dir="ltr">
                {diff200 ? `${diff200 > 0 ? '+' : ''}${diff200.toFixed(2)}%` : '-'}
              </span>
            </div>
          </div>
        )}
      </div>
    );
  }
  return null;
};

export const PriceChart: React.FC<PriceChartProps> = ({ 
  data, 
  dataKey, 
  syncId, 
  color = "#10b981", 
  showMa100 = false,
  showMa200 = false,
  label = "قیمت"
}) => {
  if (!data || data.length === 0) return null;

  const ma100Key = `ma100_${dataKey}`;
  const ma200Key = `ma200_${dataKey}`;

  return (
    <div className="w-full h-[400px]">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={data}
          syncId={syncId}
          margin={{
            top: 10,
            right: 30,
            left: 0,
            bottom: 5,
          }}
        >
          <defs>
            <linearGradient id={`colorPrice-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3}/>
              <stop offset="95%" stopColor={color} stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
          
          <XAxis 
            dataKey="date" 
            stroke="#94a3b8" 
            tick={false}
            axisLine={false}
            height={0}
          />
          
          <YAxis 
            domain={['auto', 'auto']} 
            stroke="#94a3b8"
            tick={{ fill: '#94a3b8', fontSize: 12 }}
            tickFormatter={(val) => {
                if (Math.abs(val) < 1 && val !== 0) return val.toFixed(4);
                return new Intl.NumberFormat('en-US', { notation: "compact" }).format(val);
            }}
          />
          
          <Tooltip content={<CustomTooltip labelText={label} />} cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }} />
          
          <Area 
            type="monotone" 
            dataKey={dataKey} 
            stroke={color} 
            strokeWidth={2}
            fillOpacity={1} 
            fill={`url(#colorPrice-${dataKey})`} 
            name={label}
          />

          {showMa100 && (
            <Line
              type="monotone"
              dataKey={ma100Key}
              stroke="#c084fc" // Purple-400/500ish
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: '#c084fc', stroke: '#fff', strokeWidth: 2 }}
              name="MA100"
              connectNulls
            />
          )}

          {showMa200 && (
            <Line
              type="monotone"
              dataKey={ma200Key}
              stroke="#fb923c" // Orange-400
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: '#fb923c', stroke: '#fff', strokeWidth: 2 }}
              name="MA200"
              connectNulls
            />
          )}

        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};
