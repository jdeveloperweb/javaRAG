package com.jdeveloperweb.javarag.api;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;

@ControllerAdvice
@lombok.extern.slf4j.Slf4j
public class GlobalExceptionHandler {

    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<String> handleRuntimeException(RuntimeException e) {
        log.error("❌ [ERROR] Runtime Exception: {}", e.getMessage(), e);
        return ResponseEntity.internalServerError().body("Error: " + e.getMessage());
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<String> handleIllegalArgumentException(IllegalArgumentException e) {
        log.warn("⚠️ [WARN] Invalid Argument: {}", e.getMessage());
        return ResponseEntity.badRequest().body("Invalid argument: " + e.getMessage());
    }

    @ExceptionHandler(org.springframework.web.context.request.async.AsyncRequestNotUsableException.class)
    public void handleAsyncRequestNotUsableException(org.springframework.web.context.request.async.AsyncRequestNotUsableException e) {
        log.debug("🔌 [SSE] Client disconnected or request timed out: {}", e.getMessage());
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<String> handleGeneralException(Exception e) {
        // Check for common client disconnection exceptions in the cause chain
        if (e.getMessage() != null && e.getMessage().contains("ServletOutputStream failed to flush")) {
            log.debug("🔌 [IO] Client disconnected: {}", e.getMessage());
            return null; // Let Spring handle it or just ignore
        }
        
        log.error("💥 [FATAL] Unexpected error: {} (Type: {})", e.getMessage(), e.getClass().getName(), e);
        return ResponseEntity.internalServerError().body("Fatal error: " + e.getMessage());
    }
}
