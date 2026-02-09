"use client";

import Image from "next/image";

export function Icon() {
    return (
        <>
            <Image
                src={"/favicon.ico"}
                alt={"REDEVC"}
                width={30}
                height={30}
            />
        </>
    )
}