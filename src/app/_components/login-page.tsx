import Image from "next/image";
import { Inter } from "next/font/google";

import airtableLogin from "~/assets/airtable-login.svg";
import appleIcon from "~/assets/apple.svg";
import googleIcon from "~/assets/google.svg";
import logo from "~/assets/logo.svg";
import signInMessage from "~/assets/signin message.svg";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export function LoginPage() {
  return (
    <div className={`relative h-screen w-screen overflow-hidden bg-white ${inter.className}`}>
      <main
        className="absolute left-1/2 top-[calc(50%-2px)] h-[1678px] w-[2940px] origin-top-left bg-white"
        style={{ transform: "scale(0.503685) translate(-50%, -50%)" }}
      >
        <Image
          src={airtableLogin}
          alt="Airtable login illustration"
          width={790}
          height={1158}
          className="absolute left-[1815px] top-[320px] h-[1158px] w-[790px] origin-center transition-transform duration-200 hover:scale-[1.025]"
          priority
        />
        <Image
          src={logo}
          alt="Airtable logo"
          width={84}
          height={73}
        className="absolute left-[232px] top-[199px]"
          priority
        />
        <Image
          src={signInMessage}
          alt="Sign in to Airtable"
          width={493}
          height={65}
        className="absolute left-[232px] top-[382px]"
          priority
        />
        <label
        className="absolute left-[236px] top-[546px] text-[30px] font-normal text-[#1d1d1f]"
          htmlFor="email"
        >
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
        placeholder="Email adrress"
        className="absolute left-[236px] top-[599px] h-[81px] w-[992px] rounded-[10px] border border-[#dadada] bg-transparent px-[24px] text-[30px] text-[#1d1d1f] shadow-[0_2px_6.5px_rgba(0,0,0,0.0578)] outline-none placeholder:text-[30px] placeholder:text-[#666a6d]"
        />
        <button
          type="button"
        className="absolute left-[236px] top-[732px] flex h-[80px] w-[996px] items-center justify-center rounded-[10px] bg-[#9cb3e6] text-[30px] font-normal text-white"
        >
          Continue
        </button>
      <p className="absolute left-[730px] top-[879.5px] -translate-x-1/2 -translate-y-1/2 text-[30px] font-normal text-[#666a6d]">
        or
      </p>
        <button
          type="button"
        className="absolute left-[232px] top-[947px] flex h-[80px] w-[996px] items-center justify-start rounded-[10px] border border-[#dadada] pl-[306px] text-[30px] font-normal text-[#1d1d1f] shadow-[0_2px_6.5px_rgba(0,0,0,0.0578)]"
        >
          <span>Sign in with</span>
          <span className="w-[6px]" />
          <span className="font-bold">Single Sign On</span>
        </button>
        <button
          type="button"
        className="absolute left-[232px] top-[1056px] flex h-[80px] w-[996px] items-center justify-start rounded-[10px] border border-[#dadada] pl-[321px] text-[30px] font-normal text-[#1d1d1f] shadow-[0_2px_6.5px_rgba(0,0,0,0.0578)]"
        >
          <Image src={googleIcon} alt="" width={33} height={33} className="mr-[20px]" />
          <span>Continue with</span>
          <span className="w-[6px]" />
          <span className="font-bold">Google</span>
        </button>
        <button
          type="button"
        className="absolute left-[232px] top-[1165px] flex h-[81px] w-[996px] items-center justify-start rounded-[10px] border border-[#dadada] pl-[311px] text-[30px] font-normal text-black shadow-[0_2px_6.5px_rgba(0,0,0,0.0578)]"
        >
          <Image src={appleIcon} alt="" width={40} height={48} className="mr-[14px]" />
          <span>Continue with</span>
          <span className="w-[6px]" />
          <span className="font-bold">Apple ID</span>
        </button>
      <p className="absolute left-[237px] top-[1422px] text-[25px] font-normal text-black">
          <span className="text-[#666a6d]">New to Airtable?</span>{" "}
        <a
          className="text-[#3961e4] underline decoration-[#3961e4] underline-offset-[2px] hover:no-underline"
          href="#"
        >
          Create an account
        </a>{" "}
          <span className="text-[#666a6d]">instead</span>
        </p>
      <p className="absolute left-[237px] top-[1494px] text-[25px] font-normal text-black">
          <span className="text-[#666a6d]">Manage your cookie preferences </span>
        <a
          className="text-[#3961e4] underline decoration-[#3961e4] underline-offset-[2px] hover:no-underline"
          href="#"
        >
          here
        </a>
        </p>
      </main>
    </div>
  );
}
