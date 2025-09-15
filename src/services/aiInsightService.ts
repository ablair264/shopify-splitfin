import { openaiService } from './openaiService';
import { AIInsight } from '../components/AIInsightModal/AIInsightModal';

interface DataPoint {
  name: string;
  value: number;
  change?: number;
  previousValue?: number;
  date?: string;
}

interface InsightContext {
  cardTitle: string;
  currentData: DataPoint[];
  historicalData?: DataPoint[];
  timeFrame: 'daily' | 'weekly' | 'monthly' | 'yearly';
  dataType: 'revenue' | 'orders' | 'customers' | 'products' | 'performance' | 'general';
}

export const aiInsightService = {
  /**
   * Generate AI insights for table card data
   */
  async generateInsight(context: InsightContext): Promise<AIInsight> {
    try {
      // Prepare data analysis prompt for OpenAI
      const analysisPrompt = this.createAnalysisPrompt(context);
      
      // Use OpenAI to generate insights if available
      const openaiAvailable = await openaiService.isOpenAIAvailable();
      let rawInsight: string;
      
      if (openaiAvailable) {
        rawInsight = await this.getOpenAIInsight(analysisPrompt);
      } else {
        rawInsight = this.getFallbackInsight(context);
      }
      
      // Parse the insight and structure it
      return this.parseInsightResponse(rawInsight, context);
      
    } catch (error) {
      console.error('Error generating AI insight:', error);
      throw new Error('Failed to generate insight');
    }
  },

  /**
   * Create a detailed analysis prompt for OpenAI
   */
  createAnalysisPrompt(context: InsightContext): string {
    const { cardTitle, currentData, historicalData, timeFrame, dataType } = context;
    
    // Calculate trends and changes
    const trends = this.calculateTrends(currentData, historicalData);
    const dataStats = this.calculateDataStats(currentData);
    
    return `Analyze the following business data and provide insights:

CONTEXT:
- Card Title: ${cardTitle}
- Data Type: ${dataType}
- Time Frame: ${timeFrame}
- Total Data Points: ${currentData.length}

CURRENT DATA:
${currentData.map(point => `• ${point.name}: ${point.value}`).join('\n')}

STATISTICAL ANALYSIS:
- Average: ${dataStats.average.toFixed(2)}
- Maximum: ${dataStats.max}
- Minimum: ${dataStats.min}
- Total: ${dataStats.total}

${trends.length > 0 ? `TREND ANALYSIS:\n${trends.join('\n')}` : ''}

Please provide a JSON response with the following structure:
{
  "insight": "Key insight about the data in 1-2 sentences",
  "trend": "increasing|decreasing|stable|unavailable",
  "action": "Specific recommended action based on the data",
  "priority": "low|medium|high",
  "impact": "Brief description of potential impact",
  "recommendations": ["list", "of", "specific", "recommendations"],
  "forecast": "Brief forecast or prediction based on trends",
  "volumeTrends": {
    "comparison": "How current data compares to previous periods",
    "seasonalPattern": "Any seasonal patterns observed",
    "monthlyTrend": "Monthly trend direction"
  }
}

Focus on actionable insights that can help improve business performance.`;
  },

  /**
   * Get AI insight from OpenAI
   */
  async getOpenAIInsight(prompt: string): Promise<string> {
    try {
      // Create a simple business context for OpenAI
      const businessContext = {
        customerCount: 0,
        orderCount: 0,
        productCount: 0,
        recentOrders: [],
        topProducts: [],
        companyId: 'analysis'
      };

      const response = await openaiService.generateResponse(prompt, businessContext, []);
      return response;
    } catch (error) {
      console.error('OpenAI insight generation failed:', error);
      throw error;
    }
  },

  /**
   * Parse OpenAI response into structured insight
   */
  parseInsightResponse(rawResponse: string, context: InsightContext): AIInsight {
    try {
      // Try to extract JSON from the response
      const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          insight: parsed.insight || "Analysis complete",
          trend: this.validateTrend(parsed.trend),
          action: parsed.action || "Continue monitoring performance",
          priority: this.validatePriority(parsed.priority),
          impact: parsed.impact || "Moderate impact on business metrics",
          recommendations: parsed.recommendations || [],
          forecast: parsed.forecast,
          volumeTrends: parsed.volumeTrends || {
            comparison: "Data shows current period performance",
            seasonalPattern: "Pattern analysis in progress",
            monthlyTrend: "Trend monitoring active"
          }
        };
      }
      
      // Fall back to parsing text response
      return this.parseTextResponse(rawResponse, context);
    } catch (error) {
      console.warn('Failed to parse AI response, using fallback:', error);
      return this.getFallbackStructuredInsight(context);
    }
  },

  /**
   * Parse plain text response into insight structure
   */
  parseTextResponse(response: string, context: InsightContext): AIInsight {
    const trends = this.calculateTrends(context.currentData, context.historicalData);
    const trend = trends.length > 0 ? this.inferTrend(trends[0]) : 'stable';
    
    return {
      insight: response.split('\n')[0] || "Data analysis shows current performance levels",
      trend: trend,
      action: this.extractAction(response) || "Continue monitoring and optimize based on patterns",
      priority: this.inferPriority(context.currentData),
      impact: "This data impacts overall business performance",
      recommendations: this.extractRecommendations(response),
      forecast: "Trend analysis suggests continued pattern observation is recommended",
      volumeTrends: {
        comparison: trends[0] || "Current data shows stable patterns",
        seasonalPattern: "Seasonal analysis ongoing",
        monthlyTrend: trend
      }
    };
  },

  /**
   * Calculate data statistics
   */
  calculateDataStats(data: DataPoint[]) {
    const values = data.map(point => point.value);
    return {
      average: values.reduce((sum, val) => sum + val, 0) / values.length,
      max: Math.max(...values),
      min: Math.min(...values),
      total: values.reduce((sum, val) => sum + val, 0)
    };
  },

  /**
   * Calculate trends between current and historical data
   */
  calculateTrends(currentData: DataPoint[], historicalData?: DataPoint[]): string[] {
    const trends: string[] = [];
    
    if (historicalData && historicalData.length > 0) {
      const currentTotal = currentData.reduce((sum, point) => sum + point.value, 0);
      const historicalTotal = historicalData.reduce((sum, point) => sum + point.value, 0);
      
      const percentChange = ((currentTotal - historicalTotal) / historicalTotal * 100).toFixed(1);
      
      if (Math.abs(parseFloat(percentChange)) < 5) {
        trends.push(`Stable trend with ${percentChange}% change`);
      } else if (parseFloat(percentChange) > 0) {
        trends.push(`Increasing trend with ${percentChange}% growth`);
      } else {
        trends.push(`Decreasing trend with ${percentChange}% decline`);
      }
    }
    
    // Analyze individual data point trends
    currentData.forEach(point => {
      if (point.change !== undefined) {
        trends.push(`${point.name}: ${point.change > 0 ? '+' : ''}${point.change.toFixed(1)}% change`);
      }
    });
    
    return trends;
  },

  /**
   * Infer trend from text
   */
  inferTrend(trendText: string): 'increasing' | 'decreasing' | 'stable' | 'unavailable' {
    if (trendText.toLowerCase().includes('increasing') || trendText.toLowerCase().includes('growth')) {
      return 'increasing';
    }
    if (trendText.toLowerCase().includes('decreasing') || trendText.toLowerCase().includes('decline')) {
      return 'decreasing';
    }
    if (trendText.toLowerCase().includes('stable')) {
      return 'stable';
    }
    return 'unavailable';
  },

  /**
   * Infer priority based on data values
   */
  inferPriority(data: DataPoint[]): 'low' | 'medium' | 'high' {
    const values = data.map(point => point.value);
    const max = Math.max(...values);
    const min = Math.min(...values);
    const range = max - min;
    const average = values.reduce((sum, val) => sum + val, 0) / values.length;
    
    // High priority if there's significant variation or concerning patterns
    if (range / average > 0.5) return 'high';
    if (range / average > 0.2) return 'medium';
    return 'low';
  },

  /**
   * Extract action from response text
   */
  extractAction(response: string): string | null {
    const actionKeywords = ['recommend', 'suggest', 'should', 'action', 'improve'];
    const lines = response.split('\n');
    
    for (const line of lines) {
      if (actionKeywords.some(keyword => line.toLowerCase().includes(keyword))) {
        return line.trim();
      }
    }
    return null;
  },

  /**
   * Extract recommendations from response text
   */
  extractRecommendations(response: string): string[] {
    const recommendations: string[] = [];
    const lines = response.split('\n');
    
    for (const line of lines) {
      if (line.trim().startsWith('•') || line.trim().startsWith('-') || line.trim().match(/^\d+\./)) {
        recommendations.push(line.replace(/^[•\-\d\.\s]+/, '').trim());
      }
    }
    
    return recommendations.length > 0 ? recommendations : [
      'Monitor trends regularly',
      'Compare with industry benchmarks',
      'Consider seasonal adjustments'
    ];
  },

  /**
   * Validate trend value
   */
  validateTrend(trend: string): 'increasing' | 'decreasing' | 'stable' | 'unavailable' {
    const validTrends = ['increasing', 'decreasing', 'stable', 'unavailable'];
    return validTrends.includes(trend) ? trend as any : 'stable';
  },

  /**
   * Validate priority value
   */
  validatePriority(priority: string): 'low' | 'medium' | 'high' {
    const validPriorities = ['low', 'medium', 'high'];
    return validPriorities.includes(priority) ? priority as any : 'medium';
  },

  /**
   * Fallback insight when AI is not available
   */
  getFallbackInsight(context: InsightContext): string {
    const { cardTitle, currentData, dataType } = context;
    const stats = this.calculateDataStats(currentData);
    
    return `${cardTitle} Analysis:
    
Current ${dataType} data shows an average of ${stats.average.toFixed(2)} across ${currentData.length} data points.
The highest value recorded is ${stats.max} and the lowest is ${stats.min}.

Recommendations:
• Monitor performance trends regularly
• Compare against historical benchmarks
• Consider seasonal variations in the data
• Focus on top-performing segments

This analysis provides a baseline for continued monitoring and optimization efforts.`;
  },

  /**
   * Structured fallback insight
   */
  getFallbackStructuredInsight(context: InsightContext): AIInsight {
    const stats = this.calculateDataStats(context.currentData);
    const priority = this.inferPriority(context.currentData);
    
    return {
      insight: `${context.cardTitle} shows an average of ${stats.average.toFixed(2)} with a range from ${stats.min} to ${stats.max}.`,
      trend: 'stable',
      action: 'Continue monitoring performance and compare against historical data',
      priority: priority,
      impact: 'Regular monitoring helps maintain performance standards',
      recommendations: [
        'Track trends over time',
        'Set up performance alerts',
        'Compare with benchmarks',
        'Review data regularly'
      ],
      forecast: 'Stable patterns suggest continued performance monitoring is beneficial',
      volumeTrends: {
        comparison: `Current average of ${stats.average.toFixed(2)}`,
        seasonalPattern: 'Pattern analysis in progress',
        monthlyTrend: 'Monitoring for trend identification'
      }
    };
  }
};