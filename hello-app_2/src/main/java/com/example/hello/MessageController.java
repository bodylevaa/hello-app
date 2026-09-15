package com.example.hello;

import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicLong;

@RestController
@RequestMapping("/api/messages")
public class MessageController {

    private final List<Message> messages = new CopyOnWriteArrayList<>();
    private final AtomicLong idGenerator = new AtomicLong(1);

    public MessageController() {
        messages.add(new Message(idGenerator.getAndIncrement(), "Сервер", "Привет! Это сообщение пришло с Java-бэкенда.", Instant.now()));
    }

    @GetMapping
    public List<Message> getMessages() {
        return messages;
    }

    @PostMapping
    public Message addMessage(@RequestBody MessageRequest request) {
        String author = (request.author() == null || request.author().isBlank()) ? "Аноним" : request.author().trim();
        String text = request.text() == null ? "" : request.text().trim();
        Message message = new Message(idGenerator.getAndIncrement(), author, text, Instant.now());
        messages.add(message);
        return message;
    }

    public record MessageRequest(String author, String text) {
    }
}
