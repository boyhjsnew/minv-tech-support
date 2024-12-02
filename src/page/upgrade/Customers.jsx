import React, { useState } from "react";
import { Steps } from "primereact/steps";

export default function Customers() {
  const [activeIndex, setActiveIndex] = useState(0);

  const itemRenderer = (item, itemIndex) => {
    const isActiveItem = activeIndex === itemIndex;
    const backgroundColor = isActiveItem
      ? "var(--primary-color)"
      : "var(--surface-b)";
    const textColor = isActiveItem
      ? "var(--surface-b)"
      : "var(--text-color-secondary)";

    return (
      <span
        className="inline-flex align-items-center justify-content-center align-items-center border-circle border-primary border-1 h-3rem w-3rem z-1 cursor-pointer"
        style={{
          backgroundColor: backgroundColor,
          color: textColor,
          marginTop: "100px",
        }}
        onClick={() => setActiveIndex(itemIndex)}
      >
        <i className={`${item.icon} text-xl`} />
      </span>
    );
  };

  const items = [
    {
      icon: "pi pi-user",
      template: (item) => itemRenderer(item, 0),
    },
    {
      icon: "pi pi-calendar",
      template: (item) => itemRenderer(item, 1),
    },
    {
      icon: "pi pi-check",
      template: (item) => itemRenderer(item, 2),
    },
  ];

  return (
    <div className="card">
      <Steps
        model={items}
        activeIndex={activeIndex}
        readOnly={false}
        className="m-2 pt-4"
      />
    </div>
  );
}
