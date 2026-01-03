
import React from 'react';
import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ComposedChart,
  Brush
} from 'recharts';
import { ChartDataPoint } from '../types';

interface DistanceChartProps {
  data: ChartDataPoint[];
  syncId?: string;
  showSymbol1: boolean;
  showSymbol2: boolean;
  name1: string;
  name2: string;
  dataKey1: string; // Dynamic key for Symbol 1 (e.g., dist_ma100_1 or dist_ma200_1)
  dataKey2: string; // Dynamic key for Symbol 2 (e.g., dist_ma100_ratio or dist_ma200_ratio)
  showBrush?: boolean;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-800 border border-slate-700 p-3 rounded shadow-lg text-sm text-right" dir="rtl">
        <p className="text-slate-400 mb-2 border-b border-slate-700 pb-1">{label}</p>
        {payload.map((p: any, index: number) => {
            if (p.value === null || p.value === undefined) return null;
            return (
              <div key={index} className="flex justify-between items-center gap-4 mb-1">
                 <span style={{ color: p.color }}>{p.name}:</span>
                 <span className={`font-bold ${p.value > 0 ? 'text-green-400' : 'text-red-400'}`} dir="ltr">
                   {p.value}%
                 </span>
              </div>
            );
        })}
      </div>
    );
  }
  return null;
};

export const DistanceChart = React.memo<DistanceChartProps>(({ 
  data, 
  syncId, 
  showSymbol1,
  showSymbol2,
  name1, 
  name2,
  dataKey1,
  dataKey2,
  showBrush = true 
}) => {
  if (!data || data.length === 0) return null;

  // Colors
  const color1 = '#22d3ee'; // Cyan
  const color2 = '#a855f7'; // Purple

  return (
    <div className="w-full h-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={data}
          syncId={syncId}
          margin={{
            top: 5,
            right: 30,
            left: 0,
            bottom: 5,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
          
          <XAxis 
            dataKey="date" 
            stroke="#94a3b8" 
            tick={{ fill: '#94a3b8', fontSize: 12 }}
            minTickGap={50}
          />
          
          <YAxis 
            stroke="#94a3b8"
            tick={{ fill: '#94a3b8', fontSize: 12 }}
            unit="%"
          />
          
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }} />
          
          <ReferenceLine y={0} stroke="#cbd5e1" strokeWidth={1} />
          
          {showSymbol1 && (
            <Line 
              type="monotone" 
              dataKey={dataKey1} 
              name={`فاصله ${name1}`}
              stroke={color1} 
              strokeWidth={2} 
              dot={false} 
              activeDot={{ r: 4, strokeWidth: 0, fill: '#fff' }}
              connectNulls={false}
            />
          )}

          {showSymbol2 && (
            <Line 
              type="monotone" 
              dataKey={dataKey2} 
              name={`فاصله ${name2}`}
              stroke={color2} 
              strokeWidth={2} 
              dot={false} 
              activeDot={{ r: 4, strokeWidth: 0, fill: '#fff' }}
              connectNulls={false}
            />
          )}

          {showBrush && (
             <Brush 
               dataKey="date" 
               height={30} 
               stroke="#475569" 
               fill="#1e293b" 
               tickFormatter={() => ''}
               travellerWidth={10}
             />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
});
