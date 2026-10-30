/* eslint-disable @next/next/no-img-element */
import { hue } from '@san7/core';

/** Biểu tượng đội: ảnh đội nếu có, không thì huy hiệu đom đóm. */
export function TeamCrest({ name, photoUrl, size = 44 }: { name: string; photoUrl?: string | null; size?: number }) {
  return (
    <div className="crest" aria-hidden="true" style={{ width: size, height: size, ['--h' as string]: hue(name) }}>
      {photoUrl ? <img src={photoUrl} alt="" /> : (
        <>
          <i style={{ top: size * 0.3, left: size * 0.26 }} />
          <i style={{ top: size * 0.56, left: size * 0.58, width: 4, height: 4 }} />
          <i style={{ top: size * 0.26, left: size * 0.66, width: 3, height: 3 }} />
        </>
      )}
    </div>
  );
}
