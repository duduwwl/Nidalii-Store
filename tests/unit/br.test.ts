import { describe, expect, it } from "vitest";
import { isValidCEP, isValidCPF, isValidPhoneBR, maskCEP, maskCPF, maskPhone, redactCPF } from "@/lib/br";

describe("CPF", () => {
  it("aceita CPF válido com ou sem máscara", () => {
    expect(isValidCPF("529.982.247-25")).toBe(true);
    expect(isValidCPF("52998224725")).toBe(true);
  });
  it("recusa dígito verificador errado e sequências repetidas", () => {
    expect(isValidCPF("529.982.247-24")).toBe(false);
    expect(isValidCPF("111.111.111-11")).toBe(false);
    expect(isValidCPF("123")).toBe(false);
  });
  it("mascara e oculta", () => {
    expect(maskCPF("52998224725")).toBe("529.982.247-25");
    expect(redactCPF("52998224725")).toBe("***.982.***-25");
  });
});

describe("CEP e telefone", () => {
  it("CEP", () => {
    expect(isValidCEP("01310-100")).toBe(true);
    expect(isValidCEP("0131010")).toBe(false);
    expect(maskCEP("01310100")).toBe("01310-100");
  });
  it("celular precisa do 9 e DDD válido", () => {
    expect(isValidPhoneBR("(11) 98765-4321")).toBe(true);
    expect(isValidPhoneBR("(11) 8765-4321")).toBe(true);
    expect(isValidPhoneBR("(11) 88765-4321")).toBe(false);
    expect(isValidPhoneBR("(05) 98765-4321")).toBe(false);
    expect(maskPhone("11987654321")).toBe("(11) 98765-4321");
  });
});
