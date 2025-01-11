
from transformers import WhisperProcessor, WhisperForConditionalGeneration
from Pronounciation.AIModels import NeuralASR

class WhisperASRModel(NeuralASR):
    def __init__(self, model_size="tiny"):
        # Load model and processor from HuggingFace first
        model_name = f"openai/whisper-{model_size}"
        self.processor = WhisperProcessor.from_pretrained(model_name)
        self.model = WhisperForConditionalGeneration.from_pretrained(model_name)
        
        # Initialize parent class with the model and processor as decoder
        super().__init__(model=self.model, decoder=self.processor)
        
        self.sample_rate = 16000  # Whisper expects 16kHz audio
        self._transcript = ""
        self._word_locations = []

    def processAudio(self, audio_tensor):
        try:
            # Convert audio to the format expected by the processor
            input_features = self.processor(
                audio_tensor.squeeze().numpy(),
                sampling_rate=self.sample_rate,
                return_tensors="pt"
            ).input_features

            # Generate tokens
            predicted_ids = self.model.generate(
                input_features,
                language="en",  # Force English
                task="transcribe"  # Force transcription
            )
            
            # Decode the tokens to text
            transcription = self.processor.batch_decode(
                predicted_ids, 
                skip_special_tokens=True
            )[0]

            # Store the full transcript
            self._transcript = transcription

            # Split transcript into words and create word locations
            words = transcription.split()
            total_length = len(audio_tensor.squeeze())
            avg_word_length = total_length // max(len(words), 1)

            self._word_locations = []
            for i, word in enumerate(words):
                start_ts = i * avg_word_length
                end_ts = (i + 1) * avg_word_length
                self._word_locations.append({
                    "word": word,
                    "start_ts": start_ts,
                    "end_ts": end_ts
                })

            return self._transcript

        except Exception as e:
            print(f"Error in Whisper processing: {str(e)}")
            self._transcript = ""
            self._word_locations = []
            return ""

    # Add these methods to match the expected interface
    def getTranscript(self):
        return self._transcript

    def getWordLocations(self):
        return self._word_locations