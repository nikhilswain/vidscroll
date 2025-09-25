import React, { type ReactNode } from "react";

interface TextPanelProps {
  side: "left" | "right";
  children: ReactNode;
}

const TextPanel: React.FC<TextPanelProps> = ({ side, children }) => {
  return (
    <section className={`panel ${side}`}>
      <div className="panel-content">{children}</div>
    </section>
  );
};

export default TextPanel;
