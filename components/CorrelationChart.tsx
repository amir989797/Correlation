
import React from 'react';
import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Brush,
  ComposedChart
} from 'recharts';
import { ChartDataPoint } from '../types';

interface WindowConfig {
  val: number;
  label: string;
  color: string;
}

interface CorrelationChartProps {
  data: ChartDataPoint[];
  syncId?: string;
  activeWindows: WindowConfig[];
  showBrush?: boolean;
  showXAxis?: boolean;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-800 border border-slate-700 p-3 rounded shadow-lg text-sm text-right" dir="rtl">
        <p className="text-slate-400 mb-2 border-b border-slate-700 pb-1">{label}</p>
        {payload.map((p: any, index: number) => {
            // Recharts payload name corresponds to the Line name prop
            // We use the color from the payload which Recharts inherits from the Line
            if (p.value === null || p.value === undefined) return null;
            return (
              <div key={index} className="flex justify-between items-center gap-4 mb-1">
                 <span style={{ color: p.color }}>{p.name}:</span>
                 <span className={`font-bold ${p.value > 0 ? 'text-green-400' : 'text-red-400'}`} dir="ltr">
                   {p.value}
                 </span>
              </div>
            );
        })}
      </div>
    );
  }
  return null;
};

export const CorrelationChart = React.memo<CorrelationChartProps>(({ 
  data, 
  syncId, 
  activeWindows, 
  showBrush = true,
  showXAxis = true 
}) => {
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
            left: 0,
            bottom: 5,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
          
          <XAxis 
            dataKey="date" 
            stroke="#94a3b8" 
            tick={showXAxis ? { fill: '#94a3b8', fontSize: 12 } : false}
            tickFormatter={showXAxis ? undefined : () => ''}
            height={showXAxis ? 30 : 0}
            minTickGap={50}
            axisLine={showXAxis}
          />
          
          <YAxis 
            domain={[-1, 1]} 
            stroke="#94a3b8"
            tick={{ fill: '#94a3b8', fontSize: 12 }}
            ticks={[-1, -0.5, 0, 0.5, 1]}
          />
          
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }} />
          
          <ReferenceLine y={0} stroke="#64748b" strokeDasharray="3 3" />
          
          {activeWindows.map((win) => (
             <Line 
               key={win.val}
               type="monotone" 
               dataKey={`corr_${win.val}`} 
               name={win.label}
               stroke={win.color} 
               strokeWidth={2} 
               dot={false} 
               activeDot={{ r: 4, strokeWidth: 0, fill: '#fff' }}
               connectNulls={false}
             />
          ))}

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
