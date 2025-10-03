import { Injectable } from '@angular/core';
import { GoogleGenAI, Type } from "@google/genai";
import { EntityProfile, TemporalEcho, EVPAnalysis, DetectedEntity, CrossReferenceResult, EmotionalResonanceResult, ContainmentRitual, SceneAnalysisResult, SceneObject } from '../types';

// A default fallback glyph in case image generation fails
const FALLBACK_GLYPH_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAIrSURBVHhe7ZtNattAEID7/9+dFbSIIiJaNs06h5L2Wk2zJ5NCS80rFeLz4eG/4K+gKwhKBISKgBARICISECEiQEQkIEJEgIhIQISIgBARICISECEiQEQkIEJEgIhIQISIgBARICISECEiQEQkIEJEgIhIQISIgBARICISECEiQEQkIEJEgIhIQISIgBARICISECEiQEQkIEJEgIhIQISIgBARICISECEiQEQkIEJEgIhIQISIgBARICISECEiQEQkIEJEgIhIQITw3wL8/vmx0+l0vV7/8Xg8Ho/HZDI5OTkRgZfL5XA4lMvl4+PjTqfT6XQ+n//1eDyZTAY4f2S5XF6v1/P5/Gaz+fPz89ls9vf3d7/f/08G2Gw2nU7n8/kymczn87e3t3e7XZ/P93q9brdbn8/3er0+n++3f/p/Axyfz/d6vW63W5/P93q9brfL5XKpVCoVCoXC4fD1+z/9ZwAul8vlcvl8vslk8ng8zWYz4P9I0+k0mUwul8vlcnk8Hm82m1KpFAqFw+Hw+vo6kP+Pfr+fTqdzOBwOh8PpdDgcDpVKhUKhUqlUKhUKhUqlUKhUKhUKhUqlUKhUKhUKhUqlUKhUKhUKhUqlUKhUKhUqlUKhUKhUKhUqlUKhUKhUKhUqlUKhUKhUqlUKhUKhUqlUKhUKhUqlUKhUKhUqlUKhUKhUqlUKhUKhUqlUKhUKhUqlUKhUKhUqlUKhUKhUKhUKhUKhUKhUKhUKhUKhUKhUKhUKhUKhUKhUKhUKh8N8T/sFj4iwy+vRp2oAAAAASUVORK5CYII=';

@Injectable({
  providedIn: 'root',
})
export class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      console.error("API Key not found. Please ensure it is configured in the environment.");
    }
    this.ai = new GoogleGenAI({ apiKey: apiKey! });
  }

  async getEntityProfile(strength: 'weak' | 'moderate' | 'strong' | 'critical'): Promise<EntityProfile> {
    const strengthDescription = this.getStrengthDescription(strength);
    const profilePrompt = `Generate a short, spooky, and mysterious profile for a paranormal entity. The energy signature is ${strengthDescription}. The profile must include a plausible name, a type (e.g., Poltergeist, Shade, Revenant, Wraith, Banshee, Phantom, Lingering Spirit), a one-paragraph backstory, and an 'instability' rating (a number from 50 to 100). The entity is not yet 'contained'. Do not use markdown.`;

    try {
      const profileResponse = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: profilePrompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING, description: 'The name of the entity.' },
              type: { type: Type.STRING, description: 'The classification of the spirit.' },
              backstory: { type: Type.STRING, description: 'A short, unsettling backstory.' },
              instability: { type: Type.NUMBER, description: 'A rating from 50-100 of how unstable the entity is.'},
              contained: { type: Type.BOOLEAN, description: 'Always false for new entities.'}
            },
            required: ['name', 'type', 'backstory', 'instability', 'contained'],
          },
          temperature: 1.1,
          topP: 0.95,
        },
      });
      
      const jsonText = profileResponse.text.trim();
      const profileData = JSON.parse(jsonText) as Omit<EntityProfile, 'glyphB64'>;

      // Now generate the glyph image based on the profile
      const glyphPrompt = `Create a single, minimalist, arcane, mystical sigil or glyph that represents a paranormal entity. The entity is a "${profileData.type}" known as "${profileData.name}". The glyph should be a stark white design on a pure black background. It should look ancient and mysterious. It should not be a picture of the entity, but a symbolic representation.`;
      
      let glyphB64 = FALLBACK_GLYPH_B64;
      try {
        const imageResponse = await this.ai.models.generateImages({
          model: 'imagen-3.0-generate-002',
          prompt: glyphPrompt,
          config: {
            numberOfImages: 1,
            outputMimeType: 'image/png',
            aspectRatio: '1:1',
          },
        });
        glyphB64 = imageResponse.generatedImages[0].image.imageBytes;
      } catch (imageError) {
        console.error("Gemini API call failed (generateImages):", imageError);
        // Use the fallback glyph
      }

      return { ...profileData, glyphB64 };

    } catch (error) {
      console.error("Gemini API call failed (getEntityProfile):", error);
      return {
        name: "Static Anomaly",
        type: "Unknown Interference",
        backstory: "A communication breakdown with the other side. The signal is lost in the noise, leaving only an eerie silence and a sense of being watched. What were they trying to say?",
        instability: 75,
        contained: false,
        glyphB64: FALLBACK_GLYPH_B64,
      };
    }
  }

  async analyzeScene(imageDataB64: string): Promise<SceneAnalysisResult> {
    const prompt = `Analyze this image from a first-person perspective. Identify up to 5 prominent objects or structures (like a door, chair, table, window). For each object, provide a simplified, stick-figure-like outline as an array of polylines. A polyline is an array of {x, y} points. Coordinates must be percentages (0-100) relative to the image dimensions. The outlines should be very simple and abstract. Respond in JSON format. If no objects are identifiable, return an empty 'objects' array.`;

    const imagePart = {
      inlineData: {
        mimeType: 'image/jpeg',
        data: imageDataB64,
      },
    };

    const textPart = { text: prompt };

    const response = await this.ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts: [imagePart, textPart] },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            objects: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  polylines: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          x: { type: Type.NUMBER },
                          y: { type: Type.NUMBER }
                        },
                        required: ['x', 'y']
                      }
                    }
                  }
                },
                required: ['name', 'polylines']
              }
            }
          },
          required: ['objects']
        }
      }
    });
    
    return JSON.parse(response.text.trim()) as SceneAnalysisResult;
  }

  async getEVPMessage(): Promise<EVPAnalysis> {
    const prompt = `I've captured Electronic Voice Phenomenon (EVP) audio static from a haunted location. From this static, invent a single, short, cryptic, and spooky phrase or sentence that sounds like it was whispered from another dimension. The phrase should be unsettling. Also provide a confidence score between 0.2 and 0.9.`;

    const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              transcription: { type: Type.STRING, description: 'The deciphered ghostly phrase.' },
              confidence: { type: Type.NUMBER, description: 'The confidence score of the analysis.' },
            },
            required: ['transcription', 'confidence'],
          },
          temperature: 1.2,
        },
    });

    return JSON.parse(response.text.trim()) as EVPAnalysis;
  }

  async getTemporalEcho(): Promise<TemporalEcho> {
    const prompt = `Generate a "temporal echo" from a haunted location. This is a brief, one-paragraph description of a dramatic, tragic, or emotionally charged historical event that could leave a spiritual residue. Be vague about the exact location, but specific about the emotions and actions. Provide a title for the event and the historical era (e.g., 'Victorian', 'Prohibition', 'Colonial').`;

     const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING, description: 'The title of the historical event.' },
              era: { type: Type.STRING, description: 'The historical era of the event.' },
              description: { type: Type.STRING, description: 'The one-paragraph description of the echo.' },
            },
            required: ['title', 'era', 'description'],
          },
          temperature: 1.1,
        },
    });

    return JSON.parse(response.text.trim()) as TemporalEcho;
  }
  
  async crossReferenceEntity(entity: DetectedEntity): Promise<CrossReferenceResult> {
    const prompt = `Cross-reference this paranormal entity against a global spectral database: Name: "${entity.name}", Type: "${entity.type}". Is there a known record? If so, provide a short, one-paragraph summary of its history or lore. If not, state that it's an undocumented anomaly. Respond in JSON format.`;

    const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              match: { type: Type.BOOLEAN },
              details: { type: Type.STRING },
            },
            required: ['match', 'details'],
          },
        },
    });
    return JSON.parse(response.text.trim()) as CrossReferenceResult;
  }

  async getEmotionalResonance(entity: DetectedEntity): Promise<EmotionalResonanceResult> {
    const prompt = `Analyze the backstory of the entity known as "${entity.name}" to determine its dominant emotional resonance. Backstory: "${entity.backstory}". List the top 3 emotions (e.g., Sorrow, Rage, Confusion) and a one-sentence summary of why. Respond in JSON format.`;

     const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              emotions: { type: Type.ARRAY, items: { type: Type.STRING } },
              summary: { type: Type.STRING },
            },
            required: ['emotions', 'summary'],
          },
        },
    });
    return JSON.parse(response.text.trim()) as EmotionalResonanceResult;
  }

  async getContainmentRitual(entity: DetectedEntity): Promise<ContainmentRitual> {
    const prompt = `Generate a short, 2-step, procedural-sounding containment ritual for a paranormal entity named "${entity.name}" of type "${entity.type}". The steps should be cryptic and technical-sounding. Then provide a short, one-sentence outcome message confirming the successful containment. Respond in JSON format.`;

    const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              steps: { type: Type.ARRAY, items: { type: Type.STRING } },
              outcome: { type: Type.STRING },
            },
            required: ['steps', 'outcome'],
          },
          temperature: 0.9,
        },
    });
    return JSON.parse(response.text.trim()) as ContainmentRitual;
  }


  private getStrengthDescription(strength: string): string {
    switch (strength) {
      case 'weak': return 'faint and fleeting';
      case 'moderate': return 'clear and present';
      case 'strong': return 'powerful and disruptive';
      case 'critical': return 'overwhelming and physically manifesting';
      default: return 'of unknown power';
    }
  }
}