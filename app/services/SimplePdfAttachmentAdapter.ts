import { AttachmentAdapter, PendingAttachment, CompleteAttachment } from "@assistant-ui/react";

export class SimplePdfAttachmentAdapter implements AttachmentAdapter {
    accept = "application/pdf";
  
    async add({ file }: { file: File }): Promise<PendingAttachment> {
      const id = file.name + "-" + Date.now();
      // Read file as base64
      const base64 = await this.fileToBase64DataURL(file);
      return {
        id,
        type: "document",
        name: file.name,
        contentType: file.type,
        file,
        status: { type: "running" },
        content: [
          {
            type: "file",
            file: base64, // base64 string
            name: file.name,
            contentType: file.type,
          },
        ],
      };
    }

    async send(attachment: PendingAttachment): Promise<CompleteAttachment> {
      return {
        ...attachment,
        status: { type: "complete" },
      } as CompleteAttachment;
    }

    async remove(attachment: PendingAttachment): Promise<void> {
      // No-op for now
    }

    private async fileToBase64DataURL(file: File): Promise<string> {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          // FileReader result is already a data URL
          resolve(reader.result as string);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    }
}