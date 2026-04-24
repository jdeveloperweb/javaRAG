package com.jdeveloperweb.javarag.service;

import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class MetricsServiceTest {

    private MetricsService metricsService;
    private SimpleMeterRegistry meterRegistry;

    @BeforeEach
    void setUp() {
        meterRegistry = new SimpleMeterRegistry();
        metricsService = new MetricsService(meterRegistry);
    }

    @Test
    void recordUsage_IncrementsCountersCorrectly() {
        // Arrange
        String model = "gpt-4o";
        int promptTokens = 150;
        int completionTokens = 50;
        double cost = 0.005;

        // Act
        metricsService.recordUsage(model, promptTokens, completionTokens, cost);

        // Assert
        assertEquals(150, meterRegistry.counter("llm.tokens.prompt", "model", model).count());
        assertEquals(50, meterRegistry.counter("llm.tokens.completion", "model", model).count());
        assertEquals(0.005, meterRegistry.counter("llm.cost", "model", model).count());
    }

    @Test
    void recordUsage_AccumulatesValues() {
        // Arrange
        String model = "gpt-4o-mini";

        // Act
        metricsService.recordUsage(model, 100, 20, 0.001);
        metricsService.recordUsage(model, 200, 80, 0.002);

        // Assert
        assertEquals(300, meterRegistry.counter("llm.tokens.prompt", "model", model).count());
        assertEquals(100, meterRegistry.counter("llm.tokens.completion", "model", model).count());
        assertEquals(0.003, meterRegistry.counter("llm.cost", "model", model).count(), 0.0001);
    }
}
