package com.jdeveloperweb.javarag;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication(exclude = {
    org.springframework.ai.autoconfigure.openai.OpenAiAutoConfiguration.class,
    org.springframework.ai.autoconfigure.anthropic.AnthropicAutoConfiguration.class,
    org.springframework.ai.autoconfigure.vectorstore.pgvector.PgVectorStoreAutoConfiguration.class
})
public class JavaRagApplication {

    public static void main(String[] args) {
        SpringApplication.run(JavaRagApplication.class, args);
    }

}
