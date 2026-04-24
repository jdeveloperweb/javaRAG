package com.jdeveloperweb.javarag.service;

import com.jdeveloperweb.javarag.model.ModelProviderConfig;
import com.jdeveloperweb.javarag.repository.ModelProviderConfigRepository;
import dev.langchain4j.model.chat.ChatLanguageModel;
import dev.langchain4j.model.embedding.EmbeddingModel;
import dev.langchain4j.model.openai.OpenAiEmbeddingModel;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.openai.OpenAiChatOptions;
import org.springframework.ai.openai.api.OpenAiApi;
import org.springframework.ai.anthropic.AnthropicChatOptions;
import org.springframework.ai.anthropic.api.AnthropicApi;
import dev.langchain4j.model.scoring.ScoringModel;
import dev.langchain4j.model.cohere.CohereScoringModel;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
@RequiredArgsConstructor
public class ModelService {

    private final ModelProviderConfigRepository repository;

    public java.util.List<ModelProviderConfig> getAllConfigs() {
        return repository.findAll();
    }

    public Optional<ModelProviderConfig> getActiveConfig() {
        return repository.findAll().stream()
                .filter(c -> Boolean.TRUE.equals(c.getIsActive()))
                .findFirst();
    }

    public ChatLanguageModel getChatModel(String provider) {
        ModelProviderConfig config = repository.findByProviderName(provider.toUpperCase())
                .orElseThrow(() -> new RuntimeException("Provider " + provider + " not configured in database."));

        if ("OPENAI".equalsIgnoreCase(provider)) {
            return dev.langchain4j.model.openai.OpenAiChatModel.builder()
                    .apiKey(config.getApiKey())
                    .modelName(Optional.ofNullable(config.getDefaultModelName()).orElse("gpt-4o"))
                    .build();
        } else if ("ANTHROPIC".equalsIgnoreCase(provider)) {
            return dev.langchain4j.model.anthropic.AnthropicChatModel.builder()
                    .apiKey(config.getApiKey())
                    .modelName(Optional.ofNullable(config.getDefaultModelName()).orElse("claude-3-5-sonnet-latest"))
                    .build();
        }

        throw new IllegalArgumentException("Unsupported provider: " + provider);
    }

    public EmbeddingModel getEmbeddingModel(String provider) {
        ModelProviderConfig config = repository.findByProviderName("OPENAI") // Defaulting to OpenAI for embeddings
                .orElseThrow(() -> new RuntimeException("OpenAI configuration missing for embeddings."));

        return OpenAiEmbeddingModel.builder()
                .apiKey(config.getApiKey())
                .modelName("text-embedding-3-small")
                .build();
    }

    public ChatModel getSpringAiChatModel(String provider) {
        ModelProviderConfig config = repository.findByProviderName(provider.toUpperCase())
                .orElseThrow(() -> new RuntimeException("Provider " + provider + " not configured in database."));

        if ("OPENAI".equalsIgnoreCase(provider)) {
            var openAiApi = new OpenAiApi(config.getApiKey());
            return new org.springframework.ai.openai.OpenAiChatModel(openAiApi, OpenAiChatOptions.builder()
                    .withModel(Optional.ofNullable(config.getDefaultModelName()).orElse("gpt-4o"))
                    .build());
        } else if ("ANTHROPIC".equalsIgnoreCase(provider)) {
            var anthropicApi = new AnthropicApi(config.getApiKey());
            return new org.springframework.ai.anthropic.AnthropicChatModel(anthropicApi, AnthropicChatOptions.builder()
                    .withModel(Optional.ofNullable(config.getDefaultModelName()).orElse("claude-3-5-sonnet-latest"))
                    .build());
        }

        throw new IllegalArgumentException("Unsupported provider: " + provider);
    }

    public ScoringModel getScoringModel() {
        return repository.findByProviderName("COHERE")
                .map(config -> (ScoringModel) CohereScoringModel.builder()
                        .apiKey(config.getApiKey())
                        .modelName(Optional.ofNullable(config.getDefaultModelName()).orElse("rerank-multilingual-v3.0"))
                        .build())
                .orElse(null);
    }

    public void updateConfig(String provider, String apiKey, String defaultModel, boolean isActive) {
        if (isActive) {
            // Deactivate all others
            repository.findAll().forEach(c -> {
                if (Boolean.TRUE.equals(c.getIsActive())) {
                    c.setIsActive(false);
                    repository.save(c);
                }
            });
        }

        ModelProviderConfig config = repository.findByProviderName(provider.toUpperCase())
                .orElse(ModelProviderConfig.builder().providerName(provider.toUpperCase()).build());
        
        config.setApiKey(apiKey);
        config.setDefaultModelName(defaultModel);
        config.setIsActive(isActive);
        repository.save(config);
    }
}
