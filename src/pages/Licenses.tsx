import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Code } from "lucide-react";

export default function LicensesScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const dependencies = [
    { name: "React", license: "MIT License", copyright: "Copyright (c) Meta Platforms, Inc. and affiliates." },
    { name: "Radix UI", license: "MIT License", copyright: "Copyright (c) 2022 WorkOS." },
    { name: "Zustand", license: "MIT License", copyright: "Copyright (c) 2019-2024 Paul Henschel." },
    { name: "Dexie.js", license: "Apache License 2.0", copyright: "Copyright (c) 2016 David Fahlander." },
    { name: "@zxing/library", license: "Apache License 2.0", copyright: "Copyright (c) 2015 ZXing authors." },
    { name: "Framer Motion", license: "MIT License", copyright: "Copyright (c) 2018 Framer B.V." },
    { name: "Tailwind CSS", license: "MIT License", copyright: "Copyright (c) Tailwind Labs, Inc." },
    { name: "Lucide React", license: "ISC License", copyright: "Copyright (c) 2020 lucide-react contributors." },
  ];

  return (
    <div className="safe-top h-full overflow-y-auto px-4 pb-6 pt-4">
      <button onClick={() => navigate(-1)} className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> {t("common.back")}
      </button>

      <h1 className="mb-2 text-2xl font-bold tracking-tight">Open Source Licenses</h1>
      <p className="mb-6 text-sm text-muted-foreground">We are grateful to the open-source community for providing these libraries.</p>

      <div className="space-y-4">
        {dependencies.map(({ name, license, copyright }) => (
          <div key={name} className="rounded-2xl border border-border bg-card p-4 shadow-card">
            <div className="mb-2 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <Code className="h-4 w-4" />
              </div>
              <h2 className="font-semibold">{name}</h2>
            </div>
            <div className="space-y-1 text-sm text-muted-foreground leading-relaxed">
              <div><strong className="text-foreground">License:</strong> {license}</div>
              <div>{copyright}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
