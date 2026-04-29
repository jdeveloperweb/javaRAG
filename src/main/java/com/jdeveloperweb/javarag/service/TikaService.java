package com.jdeveloperweb.javarag.service;

import org.apache.tika.Tika;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
public class TikaService {

    // setMaxStringLength(-1) remove o limite padrão de 100.000 chars para suportar arquivos grandes
    private final Tika tika;

    public TikaService() {
        this.tika = new Tika();
        this.tika.setMaxStringLength(-1);
    }

    public String extractText(MultipartFile file) {
        try {
            return tika.parseToString(file.getInputStream());
        } catch (Exception e) {
            throw new RuntimeException("Failed to extract text from file: " + file.getOriginalFilename(), e);
        }
    }
}
