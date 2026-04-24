package com.jdeveloperweb.javarag.service;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.stereotype.Service;

@Service
public class MetricsService {

    private final MeterRegistry meterRegistry;
    
    private final Counter promptTokensCounter;
    private final Counter completionTokensCounter;
    private final Counter totalCostCounter;

    public MetricsService(MeterRegistry meterRegistry) {
        this.meterRegistry = meterRegistry;
        
        this.promptTokensCounter = Counter.builder("llm.tokens.prompt")
                .description("Total number of prompt tokens used")
                .register(meterRegistry);
                
        this.completionTokensCounter = Counter.builder("llm.tokens.completion")
                .description("Total number of completion tokens used")
                .register(meterRegistry);
                
        this.totalCostCounter = Counter.builder("llm.cost")
                .description("Total estimated cost in USD")
                .register(meterRegistry);
    }

    public void recordUsage(String model, int promptTokens, int completionTokens, double cost) {
        meterRegistry.counter("llm.tokens.prompt", "model", model).increment(promptTokens);
        meterRegistry.counter("llm.tokens.completion", "model", model).increment(completionTokens);
        meterRegistry.counter("llm.cost", "model", model).increment(cost);
    }
}
