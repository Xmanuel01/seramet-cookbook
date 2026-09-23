/// <reference types="vite/client" />

declare module "mammoth" {
  type Message = { type: string; message: string }
  type ConvertResult = { value: string; messages: Message[] }
  type ConvertOptions = { styleMap?: string[]; includeDefaultStyleMap?: boolean }
  const mammoth: {
    convertToHtml(input: { arrayBuffer: ArrayBuffer }, options?: ConvertOptions): Promise<ConvertResult>
  }
  export default mammoth
}
