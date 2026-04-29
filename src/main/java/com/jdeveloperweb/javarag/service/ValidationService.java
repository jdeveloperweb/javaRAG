package com.jdeveloperweb.javarag.service;

import dev.langchain4j.model.chat.ChatLanguageModel;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Slf4j
public class ValidationService {

    private final ModelService modelService;

    public ValidationResult validate(String question, String answer, String context, String provider) {
        log.info("🕵️ [VALIDATION] Critically reviewing response...");
        
        ChatLanguageModel judge = modelService.getChatModel(provider);
        
        String prompt = String.format("""
                Você é um Auditor Crítico de Respostas RAG.
                Sua missão é garantir que a resposta seja EXAUSTIVA e TÉCNICA, especialmente sobre esquemas de banco de dados.
                
                PERGUNTA: %s
                RESPOSTA GERADA: %s
                CONTEXTO DISPONÍVEL: %s
                
                CRITÉRIOS DE AVALIAÇÃO:
                1. COMPLETUDE: Se a pergunta for sobre "quais tabelas" ou "campos", a resposta trouxe todas as menções relevantes encontradas no contexto?
                2. SINALIZAÇÃO DE MAIS DADOS: Existe no contexto menção a outras tabelas/campos que NÃO foram detalhados na resposta?
                3. SATISFAÇÃO: A resposta parece "preguiçosa" ou parou na primeira evidência encontrada?
                
                Se a resposta estiver excelente e completa: responda apenas "SATISFACTORY".
                Se a resposta puder ser melhorada com mais busca: responda "INCOMPLETE: <motivo curto>".
                """, question, answer, context);
        
        String judgeResponse = judge.generate(prompt).trim();
        
        boolean isSatisfactory = judgeResponse.equalsIgnoreCase("SATISFACTORY");
        String reason = isSatisfactory ? null : judgeResponse.replace("INCOMPLETE:", "").trim();
        
        log.info("⚖️ [VALIDATION] Result: {} {}", isSatisfactory ? "✅" : "⚠️", judgeResponse);
        
        return new ValidationResult(isSatisfactory, reason);
    }

    public record ValidationResult(boolean satisfactory, String reason) {}
}
