"use client";

import SignatureCapture from "@/components/SignatureCapture";
import { signatureApi } from "@/lib/api";

export default function SignaturePanel() {
  return (
    <SignatureCapture
      api={signatureApi}
      heading="digital signature"
      description="Draw your signature with a mouse, finger, or stylus. It's encrypted and stored so it can be reused on official documents later."
      previewAlt="Your saved signature"
    />
  );
}
