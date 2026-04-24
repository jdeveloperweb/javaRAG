package com.jdeveloperweb.javarag.repository;

import com.jdeveloperweb.javarag.model.ModelProviderConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface ModelProviderConfigRepository extends JpaRepository<ModelProviderConfig, Long> {
    Optional<ModelProviderConfig> findByProviderName(String providerName);
}
