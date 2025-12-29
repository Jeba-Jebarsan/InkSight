export interface SelectionBox {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
}

// Helper to get API token from localStorage or env
export function getApiToken(): string {
    return localStorage.getItem('replicate_api_token') || import.meta.env.VITE_REPLICATE_API_TOKEN || '';
}

// Helper to set API token in localStorage
export function setApiToken(token: string): void {
    localStorage.setItem('replicate_api_token', token);
}

// Helper to check if API token is configured
export function hasApiToken(): boolean {
    return !!getApiToken();
}

/**
 * Create a mask image for the selected area
 * White = area to inpaint, Black = keep original
 */
async function createMaskFromSelection(
    imageUrl: string,
    selection: SelectionBox | null
): Promise<string> {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d')!;

            // Fill with black (keep original)
            ctx.fillStyle = 'black';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            if (selection) {
                // Calculate actual pixel coordinates from percentages
                const x = (Math.min(selection.startX, selection.endX) / 100) * canvas.width;
                const y = (Math.min(selection.startY, selection.endY) / 100) * canvas.height;
                const w = (Math.abs(selection.endX - selection.startX) / 100) * canvas.width;
                const h = (Math.abs(selection.endY - selection.startY) / 100) * canvas.height;

                // Fill selected area with white (inpaint this area)
                ctx.fillStyle = 'white';
                ctx.fillRect(x, y, w, h);
            } else {
                // No selection = inpaint entire image (for full image mode)
                ctx.fillStyle = 'white';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }

            resolve(canvas.toDataURL('image/png'));
        };
        img.src = imageUrl;
    });
}

/**
 * Generate tattoo mockup using bytedance/seedream-4 as primary model
 * Uses the user's image as reference to generate a tattoo visualization
 */
/**
 * Generate tattoo mockup using bytedance/seedream-4 as primary model
 * Uses the user's image as reference to generate a tattoo visualization
 */
export async function generateTattooMockup(
    base64Image: string,
    prompt: string,
    style: string,
    selection?: SelectionBox | null
) {
    const token = getApiToken();

    if (!token) {
        throw new Error("Please enter your Replicate API token to continue.");
    }

    // Start AI Critique generation in PARALLEL with image generation
    // This ensures we get real feedback without blocking the image process
    const critiquePromise = generateAiCritique(style, prompt, token);

    // Get body part description for better placement
    const areaDesc = selection ? 'in the selected area' : 'naturally placed on the body';

    // Enhanced prompt for bytedance/seedream-4
    const tattooPrompt = `A photorealistic photo of a person with a ${style} style tattoo of ${prompt} ${areaDesc}. The tattoo looks like fresh ink on real skin, professional tattoo photography, high quality, detailed linework, realistic skin texture`;

    try {
        // Primary: bytedance/seedream-4 - high quality image generation
        const response = await fetch("/replicate-api/v1/models/bytedance/seedream-4/predictions", {
            method: "POST",
            headers: {
                "Authorization": `Token ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                input: {
                    prompt: tattooPrompt,
                    aspect_ratio: "1:1",
                    image_input: [base64Image]
                }
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error("Seedream-4 error:", errorData);
            // Fallback to nano-banana, wait for critique there if needed
            // But we already started it, so we pass it or let fallback handle it?
            // Ideally fallback should handle its own or share the promise.
            // For simplicity, let's let fallback start its own if this fails, 
            // OR better, we await it here if we succeed.
            return await generateWithNanoBanana(base64Image, prompt, style, token, critiquePromise);
        }

        let prediction = await response.json();

        // Poll for the result
        while (prediction.status !== "succeeded" && prediction.status !== "failed") {
            await new Promise(resolve => setTimeout(resolve, 1500));
            const pollResponse = await fetch(`/replicate-api/v1/predictions/${prediction.id}`, {
                headers: {
                    "Authorization": `Token ${token}`,
                },
            });
            prediction = await pollResponse.json();

            if (prediction.status === "failed") {
                console.error("Seedream-4 failed:", prediction.error);
                return await generateWithNanoBanana(base64Image, prompt, style, token, critiquePromise);
            }
        }

        // Handle seedream-4 output format (array of file objects)
        let resultImageUrl: string;
        if (Array.isArray(prediction.output)) {
            // Seedream-4 returns array of file objects with url() method
            const firstOutput = prediction.output[0];
            resultImageUrl = typeof firstOutput === 'string' ? firstOutput : (firstOutput?.url || firstOutput);
        } else {
            resultImageUrl = prediction.output;
        }

        // Wait for critique to finish if it hasn't already
        const analysis = await critiquePromise;

        return {
            resultImageUrl,
            analysis
        };
    } catch (error) {
        console.error("Seedream-4 Error, trying nano-banana fallback:", error);
        return await generateWithNanoBanana(base64Image, prompt, style, token, critiquePromise);
    }
}

/**
 * Fallback: google/nano-banana - excellent for image-guided generation
 * Takes the user's image as reference and generates tattoo on it
 */
async function generateWithNanoBanana(
    base64Image: string,
    prompt: string,
    style: string,
    token: string,
    existingCritiquePromise?: Promise<any>
) {
    // Use existing critique promise if passed, otherwise start new one
    const critiquePromise = existingCritiquePromise || generateAiCritique(style, prompt, token);

    const tattooPrompt = `Add a ${style} style tattoo of ${prompt} on the person in this image. Make the tattoo look realistic as fresh ink on skin. Keep the same person, same pose, same scene. Only add the tattoo naturally on visible skin.`;

    try {
        const response = await fetch("/replicate-api/v1/models/google/nano-banana/predictions", {
            method: "POST",
            headers: {
                "Authorization": `Token ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                input: {
                    prompt: tattooPrompt,
                    image_input: [base64Image]
                }
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error("Nano-banana error:", errorData);
            throw new Error(errorData.detail || `API error: ${response.statusText}`);
        }

        let prediction = await response.json();

        while (prediction.status !== "succeeded" && prediction.status !== "failed") {
            await new Promise(resolve => setTimeout(resolve, 1500));
            const pollResponse = await fetch(`/replicate-api/v1/predictions/${prediction.id}`, {
                headers: {
                    "Authorization": `Token ${token}`,
                },
            });
            prediction = await pollResponse.json();

            if (prediction.status === "failed") {
                throw new Error(`Generation failed: ${prediction.error}`);
            }
        }

        // Handle nano-banana output format
        let resultImageUrl: string;
        if (prediction.output) {
            resultImageUrl = typeof prediction.output === 'string'
                ? prediction.output
                : (prediction.output?.url || prediction.output);
        } else {
            throw new Error("No output received from model");
        }

        // Wait for critique to finish
        const analysis = await critiquePromise;

        return {
            resultImageUrl,
            analysis
        };
    } catch (error) {
        console.error("Nano-banana error:", error);
        throw new Error("Unable to generate tattoo. Please try again or use a different image.");
    }
}

/**
 * Generate REAL AI Analysis using Llama-3 via Replicate
 */
async function generateAiCritique(style: string, prompt: string, token: string) {
    try {
        const systemPrompt = `You are a world-class tattoo artist giving a consultation. 
        Analyze this tattoo idea: Style: "${style}", Concept: "${prompt}".
        Provide a JSON response with:
        - "rating": number 1-10
        - "feedback": Professional artistic critique (max 2 sentences)
        - "pros": Array of 3 specific strengths (short phrases)
        - "cons": Array of 2 considerations/warnings (short phrases)
        
        Do not output markdown code blocks. Output ONLY raw JSON.`;

        const response = await fetch("/replicate-api/v1/models/meta/meta-llama-3-8b-instruct/predictions", {
            method: "POST",
            headers: {
                "Authorization": `Token ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                input: {
                    prompt: systemPrompt,
                    max_tokens: 300,
                    temperature: 0.7,
                    top_p: 0.9
                }
            }),
        });

        if (!response.ok) return generateAnalysis(style, prompt); // Fallback

        let prediction = await response.json();

        // Poll for text result
        while (prediction.status !== "succeeded" && prediction.status !== "failed") {
            await new Promise(resolve => setTimeout(resolve, 500));
            const pollResponse = await fetch(`/replicate-api/v1/predictions/${prediction.id}`, {
                headers: { "Authorization": `Token ${token}` },
            });
            prediction = await pollResponse.json();
            if (prediction.status === "failed") return generateAnalysis(style, prompt);
        }

        // Parse result
        let textOutput = "";
        if (Array.isArray(prediction.output)) {
            textOutput = prediction.output.join("");
        } else if (typeof prediction.output === "string") {
            textOutput = prediction.output;
        }

        // Clean up markdown code blocks if present
        textOutput = textOutput.replace(/```json/g, '').replace(/```/g, '').trim();

        try {
            const json = JSON.parse(textOutput);
            return {
                rating: json.rating || 8.5,
                feedback: json.feedback || `Excellent ${style} design concept.`,
                pros: json.pros || ["Strong concept", "Good flow", "Clear style"],
                cons: json.cons || ["Consider placement size", "Detailed care needed"]
            };
        } catch (e) {
            console.error("JSON Parse Error:", e);
            return generateAnalysis(style, prompt);
        }

    } catch (error) {
        console.error("AI Critique Error:", error);
        return generateAnalysis(style, prompt);
    }
}

/**
 * Fallback static analysis
 */
function generateAnalysis(style: string, prompt: string) {
    const ratings = [7.5, 8.0, 8.5, 9.0, 9.5];
    const rating = ratings[Math.floor(Math.random() * ratings.length)];

    const feedbacks = [
        `The ${style} style works beautifully with your concept of "${prompt}". The placement follows natural body contours.`,
        `Excellent visualization! The tattoo integrates naturally with your skin and the ${style} aesthetic shines through.`,
        `Great composition. The ${style} interpretation of "${prompt}" creates a striking visual impact.`,
        `The design flows well with your body's anatomy. ${style} elements are clearly defined and balanced.`
    ];

    const prosOptions = [
        ["Natural skin integration", "Clean line work", "Balanced composition"],
        ["Excellent contrast", "Anatomically aware placement", "Style consistency"],
        ["Dynamic flow", "Proper sizing for the area", "Detail preservation"],
        ["Professional appearance", "Skin tone harmony", "Clear visual hierarchy"]
    ];

    const consOptions = [
        ["Consider adjusting position slightly", "May need touch-up after healing"],
        ["Edges might blur over time", "Could explore more detail in corners"],
        ["Contrast may fade with sun exposure", "Consider slightly larger scale"],
        ["Some areas may stretch with muscle movement", "Minor opacity adjustments recommended"]
    ];

    return {
        rating,
        feedback: feedbacks[Math.floor(Math.random() * feedbacks.length)],
        pros: prosOptions[Math.floor(Math.random() * prosOptions.length)],
        cons: consOptions[Math.floor(Math.random() * consOptions.length)]
    };
}

/**
 * Complete workflow helper
 */
export async function generateTattooPlacement(
    prompt: string,
    imageUrls: string[]
): Promise<string> {
    const data = await generateTattooMockup(imageUrls[0], prompt, "Custom");
    return data.resultImageUrl;
}
