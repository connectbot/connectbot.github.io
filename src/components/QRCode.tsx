import { QRCodeSVG } from 'qrcode.react';
import React from 'react';

type QRCodeProps = {
  value: string;
  size?: number;
  level?: 'L' | 'M' | 'Q' | 'H';
  includeMargin?: boolean;
};

export const QRCode: React.FC<QRCodeProps> = ({
  value,
  size = 128,
  level = 'L',
  includeMargin = true,
}) => {
  return (
    <QRCodeSVG
      value={value}
      size={size}
      level={level}
      includeMargin={includeMargin}
    />
  );
};
