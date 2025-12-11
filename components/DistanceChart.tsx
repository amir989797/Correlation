
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
  Area
} from 'recharts';
import { ChartDataPoint } from '../types';

interface DistanceChartProps {
  data: ChartDataPoint[];
  syncId?: string;
  showSymbol1: boolean;
  showSymbol2: boolean;
  name1: string;
  name2: string;
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

export const DistanceChart = React.memo<DistanceChartProps>(({ data, syncId, showSymbol1, showSymbol2, name1, name2 }) => {
  if (!data || data.length === 0) return null;

  return (
    <div className="w-full h-[200px]">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={data}
          syncId={syncId}
          margin={{
            top: 5,
            right: 30,
            left: 20,
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
               dataKey="dist_ma100_1" 
               name={`فاصله ${name1} از میانگین`}
               stroke="#22d3ee" // Cyan
               strokeWidth={2} 
               dot={false} 
               activeDot={{ r: 4, strokeWidth: 0, fill: '#fff' }}
               connectNulls={false}
             />
          )}

          {showSymbol2 && (
             <Line 
               type="monotone" 
               dataKey="dist_ma100_2" 
               name={`فاصله ${name2} از میانگین`}
               stroke="#a855f7" // Purple
               strokeWidth={2} 
               dot={false} 
               activeDot={{ r: 4, strokeWidth: 0, fill: '#fff' }}
               connectNulls={false}
             />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
});
