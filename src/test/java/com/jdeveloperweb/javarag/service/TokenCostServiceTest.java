package com.jdeveloperweb.javarag.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class TokenCostServiceTest {

    private TokenCostService tokenCostService;

    @BeforeEach
    void setUp() {
        tokenCostService = new TokenCostService();
    }

    @Test
    void calculateCost_Gpt4o() {
        // gpt-4o input: 5.0 per 1M, output: 15.0 per 1M
        // 1000 input = 0.005, 1000 output = 0.015, total = 0.02
        double cost = tokenCostService.calculateCost("gpt-4o", 1000, 1000);
        assertEquals(0.02, cost, 0.0001);
    }

    @Test
    void calculateCost_Gpt4oMini() {
        // gpt-4o-mini input: 0.15 per 1M, output: 0.6 per 1M
        // 1000 input = 0.00015, 1000 output = 0.0006, total = 0.00075
        double cost = tokenCostService.calculateCost("gpt-4o-mini", 1000, 1000);
        assertEquals(0.00075, cost, 0.00001);
    }

    @Test
    void calculateCost_UnknownModel_UsesDefault() {
        // Default input: 10.0 per 1M, output: 30.0 per 1M
        // 1000 input = 0.01, 1000 output = 0.03, total = 0.04
        double cost = tokenCostService.calculateCost("unknown-model", 1000, 1000);
        assertEquals(0.04, cost, 0.0001);
    }

    @Test
    void calculateCost_CaseInsensitive() {
        double costUpper = tokenCostService.calculateCost("GPT-4O", 1000, 1000);
        double costLower = tokenCostService.calculateCost("gpt-4o", 1000, 1000);
        assertEquals(costLower, costUpper, 0.0001);
    }
}
