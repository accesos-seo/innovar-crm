import * as React from 'react';
import { LucideIcon } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface MetricData {
  title: string;
  value: string | number;
  description: string;
  icon: LucideIcon;
  trend?: 'up' | 'down' | 'neutral';
  color?: 'blue' | 'purple' | 'yellow' | 'green' | 'primary' | 'destructive' | 'red';
}

interface MetricsGridProps {
  metrics: MetricData[];
  className?: string;
}

const colorShadowMap = {
  blue: "hover:shadow-blue-500/30 hover:border-l-blue-500 border-l-blue-500/20",
  purple: "hover:shadow-purple-500/30 hover:border-l-purple-500 border-l-purple-500/20",
  yellow: "hover:shadow-yellow-500/30 hover:border-l-yellow-500 border-l-yellow-500/20",
  green: "hover:shadow-green-500/30 hover:border-l-green-500 border-l-green-500/20",
  primary: "hover:shadow-primary/30 hover:border-l-primary border-l-primary/20",
  destructive: "hover:shadow-destructive/30 hover:border-l-destructive border-l-destructive/20",
  red: "hover:shadow-red-500/30 hover:border-l-red-500 border-l-red-500/20",
};

export const MetricsGrid = React.memo(function MetricsGrid({ metrics, className }: MetricsGridProps) {
  const gridCols = metrics.length === 3 ? "lg:grid-cols-3" : metrics.length >= 4 ? "lg:grid-cols-4" : "lg:grid-cols-2";

  return (
    <div className={cn("grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8 w-full", gridCols, className)}>
      {metrics.map((metric, index) => (
        <Card 
          key={index} 
          className={cn(
            "bg-card/50 border-border/10 transition-all duration-300 ease-in-out hover:-translate-y-1 hover:shadow-2xl group rounded-sm overflow-hidden border-l-4",
            metric.color ? colorShadowMap[metric.color] : "border-l-primary/20 hover:border-l-primary hover:shadow-primary/30"
          )}
        >
          <CardContent className="p-6 flex items-center justify-between h-full">
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                {metric.title}
              </p>
              <h3 className="text-3xl font-black text-foreground tracking-tight">
                {metric.value}
              </h3>
              <p className={cn(
                "text-[10px] font-bold uppercase tracking-wider",
                metric.trend === 'up' ? 'text-primary' : 
                metric.trend === 'down' ? 'text-destructive' : 
                'text-muted-foreground'
              )}>
                {metric.description}
              </p>
            </div>
            <div className={cn(
               "w-12 h-12 rounded-sm border transition-colors flex items-center justify-center shrink-0",
               metric.color === 'primary' ? "bg-primary/10 border-primary/20 group-hover:bg-primary/20" :
               metric.color === 'blue' ? "bg-blue-500/10 border-blue-500/20 group-hover:bg-blue-500/20" :
               metric.color === 'yellow' ? "bg-yellow-500/10 border-yellow-500/20 group-hover:bg-yellow-500/20" :
               metric.color === 'red' ? "bg-red-500/10 border-red-500/20 group-hover:bg-red-500/20" :
               metric.color === 'green' ? "bg-green-500/10 border-green-500/20 group-hover:bg-green-500/20" :
               metric.color === 'destructive' ? "bg-destructive/10 border-destructive/20 group-hover:bg-destructive/20" :
               "bg-primary/10 border-primary/20 group-hover:bg-primary/20"
            )}>
              <metric.icon className={cn(
                "w-6 h-6",
                metric.color === 'blue' ? "text-blue-500" :
                metric.color === 'yellow' ? "text-yellow-500" :
                metric.color === 'red' ? "text-red-500" :
                metric.color === 'green' ? "text-green-500" :
                metric.color === 'destructive' ? "text-destructive" :
                "text-primary"
              )} aria-hidden="true" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
});
