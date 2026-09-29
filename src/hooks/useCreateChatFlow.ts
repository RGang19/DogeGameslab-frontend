import { useCallback, useState } from "react";
import {
  CREATE_CHAT_GREETING,
  ChatMessage,
  ChatStage,
  fetchConceptFromAgent,
} from "@/lib/createChatFlow";

type UseCreateChatFlowOptions = {
  onReady?: (prompt: string) => void;
  onPromptChange?: (prompt: string) => void;
};

export function useCreateChatFlow(options: UseCreateChatFlowOptions = {}) {
  const { onReady, onPromptChange } = options;
  const [chatStage, setChatStage] = useState<ChatStage>("game");
  const [chatInput, setChatInput] = useState("");
  const [gameRequest, setGameRequest] = useState("");
  const [vibeRequest, setVibeRequest] = useState("");
  const [selectedConcept, setSelectedConcept] = useState("");
  const [finalPrompt, setFinalPrompt] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", text: CREATE_CHAT_GREETING },
  ]);

  const chatPrompt = [gameRequest, vibeRequest].filter(Boolean).join(". ");
  const freshChat = chatStage === "game" && messages.length <= 1;

  const sendChat = useCallback(
    (text = chatInput) => {
      const value = text.trim();
      if (!value || isThinking) return;
      setChatInput("");

      if (chatStage === "game") {
        setGameRequest(value);
        setChatStage("vibe");
        onPromptChange?.(value);
        setMessages((current) => [
          ...current,
          { role: "user", text: value },
          {
            role: "assistant",
            text: `Awesome! ${value} sounds great. Any specific vibes in mind, or want me to suggest some?`,
          },
        ]);
        return;
      }

      if (chatStage === "vibe") {
        const requestedGame = gameRequest || value;
        setVibeRequest(value);
        onPromptChange?.([gameRequest, value].filter(Boolean).join(". "));
        setMessages((current) => [
          ...current,
          { role: "user", text: value },
          { role: "assistant", text: `Perfect choice. Cooking up a ${value} concept…` },
        ]);
        setIsThinking(true);
        void (async () => {
          try {
            const concept = await fetchConceptFromAgent(requestedGame, value);
            // If the model job fails, retain the user's exact request instead
            // of substituting an unrelated template-derived game.
            const prompt = [requestedGame, value, concept].filter(Boolean).join(". ");
            setSelectedConcept(concept ?? "");
            setFinalPrompt(prompt);
            setChatStage("ready");
            onPromptChange?.(prompt);
            setMessages((current) => [
              ...current,
              ...(concept
                ? [{ role: "assistant" as const, text: concept }]
                : [{
                    role: "assistant" as const,
                    text: "I couldn't expand the concept, but your exact game idea and vibe are saved.",
                  }]),
              {
                role: "assistant",
                text: "Choose one of the three generation options below to start building.",
              },
            ]);
            onReady?.(prompt);
          } catch {
            setChatStage("vibe");
            setMessages((current) => [
              ...current,
              {
                role: "assistant",
                text: "Something went wrong while creating your concept. Please try another vibe.",
              },
            ]);
          } finally {
            setIsThinking(false);
          }
        })();
        return;
      }

    },
    [
      chatInput,
      chatStage,
      gameRequest,
      isThinking,
      onPromptChange,
      onReady,
      selectedConcept,
      vibeRequest,
    ],
  );

  const submitComposerPrompt = useCallback(() => {
    const value = chatInput.trim();
    if (!value || isThinking) return;

    if (chatStage === "game" || chatStage === "vibe") {
      sendChat(value);
      return;
    }

    const prompt = [finalPrompt || chatPrompt, value].filter(Boolean).join(". ");
    setFinalPrompt(prompt);
    setChatInput("");
    onPromptChange?.(prompt);
    setMessages((current) => [
      ...current,
      { role: "user", text: value },
      { role: "assistant", text: "Got it — ready when you are!" },
    ]);
    onReady?.(prompt);
  }, [chatInput, chatPrompt, chatStage, finalPrompt, isThinking, onPromptChange, onReady, sendChat]);

  const resetChat = useCallback(() => {
    setChatStage("game");
    setChatInput("");
    setGameRequest("");
    setVibeRequest("");
    setSelectedConcept("");
    setFinalPrompt("");
    setIsThinking(false);
    setMessages([{ role: "assistant", text: CREATE_CHAT_GREETING }]);
  }, []);

  return {
    messages,
    setMessages,
    chatStage,
    setChatStage,
    chatInput,
    setChatInput,
    gameRequest,
    setGameRequest,
    vibeRequest,
    setVibeRequest,
    selectedConcept,
    finalPrompt,
    setFinalPrompt,
    sendChat,
    submitComposerPrompt,
    chatPrompt,
    isThinking,
    freshChat,
    resetChat,
  };
}
