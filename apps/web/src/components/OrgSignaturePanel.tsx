"use client";

import SignatureCapture from "@/components/SignatureCapture";
import { orgSignatureApi } from "@/lib/api";

export default function OrgSignaturePanel() {
  return (
    <SignatureCapture
      api={orgSignatureApi}
      heading="dean / patron signature"
      description="Capture the Dean or Club Patron's signature here — with their permission. It's encrypted and stored so it can be reused on official documents later, like certificates. Visible only to the Chairperson."
      previewAlt="Dean/Patron's saved signature"
    />
  );
}
