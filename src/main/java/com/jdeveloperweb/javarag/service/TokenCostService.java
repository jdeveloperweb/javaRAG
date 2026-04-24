package com.jdeveloperweb.javarag.service;

import org.springframework.stereotype.Service;
import java.util.HashMap;
import java.util.Map;

@Service
public class TokenCostService {

    private static final Map<String, Double> INPUT_PRICES = new HashMap<>();
    private static final Map<String, Double> OUTPUT_PRICES = new HashMap<>();

    static {
        // Prices per 1,000,000 tokens
        INPUT_PRICES.put("gpt-4o", 5.0);
        OUTPUT_PRICES.put("gpt-4o", 15.0);
        
        INPUT_PRICES.put("gpt-4o-mini", 0.15);
        OUTPUT_PRICES.put("gpt-4o-mini", 0.6);

        INPUT_PRICES.put("claude-3-5-sonnet-latest", 3.0);
        OUTPUT_PRICES.put("claude-3-5-sonnet-latest", 15.0);

        INPUT_PRICES.put("claude-3-opus-latest", 15.0);
        OUTPUT_PRICES.put("claude-3-opus-latest", 75.0);
        
        INPUT_PRICES.put("text-embedding-3-small", 0.02);
    }

    public double calculateCost(String model, int promptTokens, int completionTokens) {
        double inputPrice = INPUT_PRICES.getOrDefault(model.toLowerCase(), 10.0) / 1_000_000.0;
        double outputPrice = OUTPUT_PRICES.getOrDefault(model.toLowerCase(), 30.0) / 1_000_000.0;

        return (promptTokens * inputPrice) + (completionTokens * outputPrice);
    }
}
