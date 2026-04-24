package com.jdeveloperweb.javarag.config;

import dev.langchain4j.data.segment.TextSegment;
import dev.langchain4j.store.embedding.EmbeddingStore;
import dev.langchain4j.store.embedding.pgvector.PgVectorEmbeddingStore;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class VectorStoreConfig {

    @Value("${spring.datasource.url}")
    private String url;

    @Value("${spring.datasource.username}")
    private String username;

    @Value("${spring.datasource.password}")
    private String password;

    @Bean
    public EmbeddingStore<TextSegment> embeddingStore() {
        // We'll use the default 'items' table and dimension 1536 (default for OpenAI)
        // In a real scenario, this dimension should match the model used.
        return PgVectorEmbeddingStore.builder()
                .host(getHostFromJdbcUrl(url))
                .port(getPortFromJdbcUrl(url))
                .database(getDatabaseFromJdbcUrl(url))
                .user(username)
                .password(password)
                .table("test_embeddings")
                .dimension(1536) // Standard for text-embedding-3-small
                .createTable(true)
                .build();
    }

    private String getHostFromJdbcUrl(String url) {
        return url.split("//")[1].split(":")[0];
    }

    private Integer getPortFromJdbcUrl(String url) {
        return Integer.parseInt(url.split("//")[1].split(":")[1].split("/")[0]);
    }

    private String getDatabaseFromJdbcUrl(String url) {
        return url.split("//")[1].split("/")[1];
    }
}
