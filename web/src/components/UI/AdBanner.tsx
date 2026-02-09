import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@heroui/react";
import Image from "next/image";

const ADS = [
  {
    id: 1,
    image: "/ads/centraldeadubos.png",
    link: "https://www.centraldeadubos.com.br/",
    alt: "Central de Adubos",
  },
//   {
//     id: 2,
//     image: "https://via.placeholder.com/1200x180?text=Banner+2",
//     link: "#",
//     alt: "Banner promocional 2",
//   },
//   {
//     id: 3,
//     image: "https://via.placeholder.com/1200x180?text=Banner+3",
//     link: "#",
//     alt: "Banner promocional 3",
//   },
];

export default function AdBannerCarousel() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % ADS.length);
    }, 6000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full flex justify-center bg-neutral-800 backdrop-blur-sm">
      <div className="w-full max-w-7xl px-4 py-3">
        <Card className="overflow-hidden rounded-2xl shadow-sm">
          <AnimatePresence mode="wait">
            <motion.a
              key={ADS[index].id}
              href={ADS[index].link}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.45, ease: "easeOut" }}
              className="block"
            >
              <Image
                src={ADS[index].image}
                alt={ADS[index].alt}
                className="w-full h-[160px] object-cover"
                width={1200}
                height={180}
                priority={false}
              />
            </motion.a>
          </AnimatePresence>
        </Card>
      </div>
    </div>
  );
}
