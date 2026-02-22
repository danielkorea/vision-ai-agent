import React, { useState, useRef } from 'react';
import { 
  Upload, 
  Image as ImageIcon, 
  X, 
  Sparkles, 
  Download, 
  RefreshCw, 
  Video, 
  Copy, 
  Check,
  Zap,
  Layers,
  Palette,
  Layout,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";
import Markdown from 'react-markdown';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Utility for Tailwind class merging
 */
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Constants ---

const SCENES = [
  { id: 'city', label: '🏙️ 城市街道', prompt: 'in a bustling city street with skyscrapers and traffic' },
  { id: 'nature', label: '🌿 自然风光', prompt: 'in a serene natural landscape with mountains and lakes' },
  { id: 'ocean', label: '🌊 海洋沙滩', prompt: 'on a beautiful beach with turquoise water and waves' },
  { id: 'space', label: '🚀 太空宇宙', prompt: 'in deep space surrounded by stars and nebulae' },
  { id: 'fantasy', label: '🏰 奇幻世界', prompt: 'in a magical fantasy realm with floating islands and mystical creatures' },
  { id: 'cyberpunk', label: '🤖 赛博朋克', prompt: 'in a futuristic cyberpunk city with neon lights and rain' },
  { id: 'ancient', label: '🏛️ 古代场景', prompt: 'in an ancient historical setting with traditional architecture' },
  { id: 'indoor', label: '🏠 室内场景', prompt: 'in a cozy and modern indoor living space' },
];

const STYLES = [
  { id: 'merged', label: '合并场景', prompt: 'seamlessly merged artistic style' },
  { id: 'surreal', label: '超现实艺术', prompt: 'surrealist masterpiece, dreamlike atmosphere' },
  { id: 'anime', label: '动漫风格', prompt: 'high-quality anime illustration style' },
  { id: 'cinematic', label: '电影级', prompt: 'cinematic lighting, hyper-realistic, 8k resolution' },
  { id: '3d', label: '3D 渲染', prompt: 'octane render, 3D digital art, highly detailed' },
  { id: 'oil', label: '油画', prompt: 'classical oil painting texture, expressive brushstrokes' },
];

// --- Types ---

interface UploadedFile {
  id: string;
  file: File;
  preview: string;
  base64: string;
}

// --- App Component ---

export default function App() {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [description, setDescription] = useState('');
  const [selectedScene, setSelectedScene] = useState(SCENES[0].id);
  const [selectedStyle, setSelectedStyle] = useState(STYLES[0].id);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [videoScript, setVideoScript] = useState<string | null>(null);
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Handlers ---

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(e.target.files || []);
    if (files.length + newFiles.length > 6) {
      setError('最多只能上传6张图片');
      return;
    }

    const processedFiles = await Promise.all(
      newFiles.map(async (file) => {
        const base64 = await fileToBase64(file);
        return {
          id: Math.random().toString(36).substr(2, 9),
          file,
          preview: URL.createObjectURL(file),
          base64: base64.split(',')[1], // Remove prefix
        };
      })
    );

    setFiles((prev) => [...prev, ...processedFiles]);
    setError(null);
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  const generateImage = async () => {
    if (!description && files.length === 0) {
      setError('请输入描述或上传图片');
      return;
    }

    setIsGenerating(true);
    setGeneratedImage(null);
    setVideoScript(null);
    setError(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const scene = SCENES.find(s => s.id === selectedScene)?.prompt || '';
      const style = STYLES.find(s => s.id === selectedStyle)?.prompt || '';
      
      const prompt = `Create a new creative image based on the following description: ${description}. 
      The scene should be ${scene}. 
      The overall style should be ${style}. 
      If reference images are provided, blend their visual elements, subjects, or color palettes into this new creation.`;

      const parts = [
        { text: prompt },
        ...files.map(f => ({
          inlineData: {
            data: f.base64,
            mimeType: f.file.type
          }
        }))
      ];

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts },
        config: {
          imageConfig: {
            aspectRatio: "16:9",
          }
        }
      });

      let foundImage = false;
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          setGeneratedImage(`data:image/png;base64,${part.inlineData.data}`);
          foundImage = true;
          break;
        }
      }

      if (!foundImage) {
        throw new Error('未能生成图片，请重试');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || '生成图片时发生错误');
    } finally {
      setIsGenerating(false);
    }
  };

  const generateVideoScript = async () => {
    if (!generatedImage) return;

    setIsGeneratingScript(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const scene = SCENES.find(s => s.id === selectedScene)?.label || '';
      
      const prompt = `Based on the generated image and the original description "${description}" in the ${scene} scene, 
      generate a detailed 5-second video script. 
      The script should include:
      1. Scene Description (Visuals)
      2. Camera Movement
      3. Lighting & Atmosphere
      4. A brief "Action" that happens in these 5 seconds.
      
      Format the output in professional cinematic script style using Markdown. Use Chinese.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });

      setVideoScript(response.text || '无法生成文案');
    } catch (err: any) {
      console.error(err);
      setError('生成视频文案时发生错误');
    } finally {
      setIsGeneratingScript(false);
    }
  };

  const downloadImage = () => {
    if (!generatedImage) return;
    const link = document.createElement('a');
    link.href = generatedImage;
    link.download = `vision-ai-${Date.now()}.png`;
    link.click();
  };

  const copyToClipboard = () => {
    if (!videoScript) return;
    navigator.clipboard.writeText(videoScript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // --- Render Helpers ---

  return (
    <div className="min-h-screen bg-[#0a051a] text-white font-sans selection:bg-purple-500/30">
      {/* Background Glows */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-900/20 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-900/20 blur-[120px] rounded-full" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 py-12">
        {/* Header */}
        <header className="text-center mb-16">
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-6"
          >
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span className="text-sm font-medium text-purple-200">Next-Gen Creative Engine</span>
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-6xl md:text-7xl font-bold tracking-tighter mb-6 bg-gradient-to-b from-white to-white/50 bg-clip-text text-transparent"
          >
            Vision AI Agent
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-lg text-gray-400 max-w-2xl mx-auto"
          >
            融合多重灵感，创造无限可能。上传参考图，选择场景，开启你的 AI 视觉创作之旅。
          </motion.p>
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Controls */}
          <div className="lg:col-span-5 space-y-6">
            {/* Upload Section */}
            <section className="p-6 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="flex items-center gap-2 font-semibold text-purple-200">
                  <Layers className="w-4 h-4" />
                  参考图片 ({files.length}/6)
                </h3>
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
                >
                  添加更多
                </button>
              </div>

              <div 
                onClick={() => files.length === 0 && fileInputRef.current?.click()}
                className={cn(
                  "relative min-h-[160px] rounded-2xl border-2 border-dashed transition-all duration-300 flex flex-wrap gap-3 p-4",
                  files.length === 0 
                    ? "border-white/10 hover:border-purple-500/50 cursor-pointer bg-white/[0.02]" 
                    : "border-transparent bg-white/[0.05]"
                )}
              >
                <input 
                  type="file" 
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  multiple 
                  accept="image/*"
                  className="hidden"
                />

                {files.length === 0 ? (
                  <div className="w-full flex flex-col items-center justify-center text-gray-500">
                    <Upload className="w-8 h-8 mb-2 opacity-50" />
                    <p className="text-sm">点击或拖拽上传参考图</p>
                  </div>
                ) : (
                  <AnimatePresence>
                    {files.map((file) => (
                      <motion.div 
                        key={file.id}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="group relative w-20 h-20 rounded-xl overflow-hidden border border-white/10"
                      >
                        <img src={file.preview} alt="Preview" className="w-full h-full object-cover" />
                        <button 
                          onClick={(e) => { e.stopPropagation(); removeFile(file.id); }}
                          className="absolute top-1 right-1 p-1 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                )}
              </div>
            </section>

            {/* Prompt Section */}
            <section className="p-6 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xl">
              <h3 className="flex items-center gap-2 font-semibold text-purple-200 mb-4">
                <Zap className="w-4 h-4" />
                创意描述
              </h3>
              <textarea 
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="描述你想要生成的画面内容..."
                className="w-full h-32 bg-white/5 border border-white/10 rounded-2xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all resize-none"
              />
            </section>

            {/* Scene & Style Section */}
            <section className="p-6 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xl space-y-6">
              <div>
                <h3 className="flex items-center gap-2 font-semibold text-purple-200 mb-4">
                  <Layout className="w-4 h-4" />
                  场景选择
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {SCENES.map((scene) => (
                    <button
                      key={scene.id}
                      onClick={() => setSelectedScene(scene.id)}
                      className={cn(
                        "px-3 py-2 rounded-xl text-xs font-medium transition-all border",
                        selectedScene === scene.id 
                          ? "bg-purple-600/20 border-purple-500 text-purple-200" 
                          : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10"
                      )}
                    >
                      {scene.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="flex items-center gap-2 font-semibold text-purple-200 mb-4">
                  <Palette className="w-4 h-4" />
                  艺术风格
                </h3>
                <div className="grid grid-cols-3 gap-2">
                  {STYLES.map((style) => (
                    <button
                      key={style.id}
                      onClick={() => setSelectedStyle(style.id)}
                      className={cn(
                        "px-2 py-2 rounded-xl text-[10px] font-medium transition-all border uppercase tracking-wider",
                        selectedStyle === style.id 
                          ? "bg-indigo-600/20 border-indigo-500 text-indigo-200" 
                          : "bg-white/5 border-white/10 text-gray-500 hover:bg-white/10"
                      )}
                    >
                      {style.label}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            {/* Action Button */}
            <button 
              onClick={generateImage}
              disabled={isGenerating}
              className={cn(
                "w-full py-4 rounded-2xl font-bold text-lg transition-all flex items-center justify-center gap-2 shadow-lg shadow-purple-500/20",
                isGenerating 
                  ? "bg-purple-900/50 cursor-not-allowed" 
                  : "bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 active:scale-[0.98]"
              )}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  正在生成中...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  生成图片
                </>
              )}
            </button>

            {error && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm"
              >
                <AlertCircle className="w-4 h-4" />
                {error}
              </motion.div>
            )}
          </div>

          {/* Right Column: Results */}
          <div className="lg:col-span-7">
            <div className="sticky top-8 space-y-6">
              {/* Image Result Card */}
              <div className="relative aspect-video rounded-[2rem] overflow-hidden bg-white/5 border border-white/10 backdrop-blur-xl group">
                {!generatedImage && !isGenerating && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-600">
                    <ImageIcon className="w-16 h-16 mb-4 opacity-20" />
                    <p className="text-sm font-medium">生成结果将在此处显示</p>
                  </div>
                )}

                {isGenerating && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div className="relative">
                      <div className="w-20 h-20 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Sparkles className="w-8 h-8 text-purple-500 animate-pulse" />
                      </div>
                    </div>
                    <p className="mt-6 text-purple-200 font-medium animate-pulse">AI 正在构思画面...</p>
                  </div>
                )}

                {generatedImage && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="w-full h-full"
                  >
                    <img src={generatedImage} alt="Generated" className="w-full h-full object-cover" />
                    
                    {/* Floating Controls */}
                    <div className="absolute bottom-6 right-6 flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <button 
                        onClick={downloadImage}
                        className="p-3 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-xl border border-white/20 transition-all"
                        title="下载图片"
                      >
                        <Download className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={generateImage}
                        className="p-3 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-xl border border-white/20 transition-all"
                        title="重新生成"
                      >
                        <RefreshCw className="w-5 h-5" />
                      </button>
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Video Script Result */}
              <AnimatePresence>
                {generatedImage && (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-8 rounded-[2rem] bg-white/5 border border-white/10 backdrop-blur-xl"
                  >
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="flex items-center gap-2 font-bold text-xl text-purple-200">
                        <Video className="w-5 h-5" />
                        5秒视频文案脚本
                      </h3>
                      {!videoScript && !isGeneratingScript ? (
                        <button 
                          onClick={generateVideoScript}
                          className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-xl text-xs font-bold transition-all flex items-center gap-2"
                        >
                          <Sparkles className="w-3 h-3" />
                          生成脚本
                        </button>
                      ) : videoScript && (
                        <button 
                          onClick={copyToClipboard}
                          className="flex items-center gap-2 text-xs text-gray-400 hover:text-white transition-colors"
                        >
                          {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                          {copied ? '已复制' : '复制脚本'}
                        </button>
                      )}
                    </div>

                    {isGeneratingScript ? (
                      <div className="flex flex-col items-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-purple-500 mb-4" />
                        <p className="text-sm text-gray-500">正在编写电影级脚本...</p>
                      </div>
                    ) : videoScript ? (
                      <div className="prose prose-invert prose-sm max-w-none prose-headings:text-purple-300 prose-strong:text-purple-200 prose-p:text-gray-400">
                        <Markdown>{videoScript}</Markdown>
                      </div>
                    ) : (
                      <div className="text-center py-12 border-2 border-dashed border-white/5 rounded-2xl">
                        <p className="text-sm text-gray-600">点击上方按钮生成基于此图片的视频脚本</p>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="mt-24 pt-8 border-t border-white/5 text-center text-gray-600 text-xs">
          <p>© 2024 Vision AI Agent. Powered by Gemini Pro Vision.</p>
        </footer>
      </div>
    </div>
  );
}
