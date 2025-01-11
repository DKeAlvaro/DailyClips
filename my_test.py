import torch
import os
import torchaudio
from Pronounciation.whisper_wrapper import WhisperASRModel
from Pronounciation.RuleBasedModels import EngPhonemConverter
from Pronounciation.pronunciationTrainer import PronunciationTrainer

def initialize_trainer(model_size="small"):
    phoneme_converter = EngPhonemConverter()
    asr_model = WhisperASRModel(model_size=model_size)  
    trainer = PronunciationTrainer(asr_model, phoneme_converter)
    return trainer

def load_audio(file_path):
    try:
        # Check if file exists
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"Audio file not found at: {file_path}")
            
        # Load audio file using torchaudio instead of soundfile
        print(f"Loading audio file from: {file_path}")
        waveform, sample_rate = torchaudio.load(file_path)
        
        # Resample to 16kHz if needed (Whisper expects 16kHz)
        if sample_rate != 16000:
            resampler = torchaudio.transforms.Resample(sample_rate, 16000)
            waveform = resampler(waveform)
            sample_rate = 16000
        
        print(f"Audio loaded. Shape: {waveform.shape}, Sample rate: {sample_rate}")
        
        # Convert to mono if stereo
        if waveform.shape[0] > 1:
            waveform = torch.mean(waveform, dim=0, keepdim=True)
        
        # Normalize audio
        waveform = waveform / waveform.abs().max()
        
        print(f"Successfully loaded audio file: {file_path}")
        print(f"Audio tensor shape: {waveform.shape}")
        print(f"Audio tensor min/max values: {waveform.min():.3f}/{waveform.max():.3f}")
        
        return waveform

    except Exception as e:
        print(f"Error loading audio file: {str(e)}")
        raise

def get_audio_results(audio_file_path, trainer, text_to_match):
    """
    Process an audio file and return pronunciation results.
    
    Args:
        audio_file_path (str): Path to the WAV file to process
        trainer (PronunciationTrainer): Instance of PronunciationTrainer
        text_to_match (str): The expected text to compare against
        
    Returns:
        dict: Results containing pronunciation accuracy, transcript, and word-level metrics
    """
    try:
        # Load and process the audio file
        audio_tensor = load_audio(audio_file_path)
        
        # Process audio and get results
        result = trainer.processAudioForGivenText(audio_tensor, text_to_match)
        return result
        
    except Exception as e:
        print(f"Error processing audio: {str(e)}")
        return None

def main():
    print("Initializing ASR model...")
    asr_model = WhisperASRModel(model_size="tiny")  
    phoneme_converter = EngPhonemConverter()
    
    print("Creating pronunciation trainer...")
    trainer = PronunciationTrainer(asr_model, phoneme_converter)
    audio_file_path = "hello-world.wav"
    text_to_match = "hello i am testing my automatic speech recognition program"

    print(f"Processing audio file: {audio_file_path}")
    print(f"Expected text: {text_to_match}")

    result = get_audio_results(audio_file_path, trainer, text_to_match)        
    print("\n=== Results ===")
    print(f"Pronunciation Accuracy: {result.get('pronunciation_accuracy', 'N/A')}")
    print(f"Recorded Transcript: {result.get('recording_transcript', 'N/A')}")
    print(f"IPA Transcript: {result.get('recording_ipa', 'N/A')}")
    print("\nWord Accuracies:")            
    categories = result.get('pronunciation_categories', [])
    for item in categories:
        print(f"Category item: {item}")

if __name__ == "__main__":
    main()