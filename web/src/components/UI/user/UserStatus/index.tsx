"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { FaUserCircle } from "react-icons/fa";
import { useForm, useWatch } from "react-hook-form";

import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  Button,
  Tab,
  Tabs,
  Input,
  Checkbox,
  addToast,
} from "@heroui/react";

import {
  LuUser,
  LuUserPlus,
  LuMail,
  LuLock,
  LuEye,
  LuEyeOff,
} from "react-icons/lu";

import { auth } from "@/lib/auth";

/* =======================
   Schemas (Zod)
======================= */

const signInSchema = z.object({
  email: z.email("Email inválido"),
  password: z.string().min(8, "Senha deve ter no mínimo 8 caracteres"),
  rememberMe: z.boolean(),
});

type SignInSchema = z.infer<typeof signInSchema>;

const signUpSchema = z.object({
  name: z.string().min(3, "Nome deve ter no mínimo 3 caracteres"),
  email: z.email("Email inválido"),
  password: z.string().min(8, "Senha deve ter no mínimo 8 caracteres"),
});

type SignUpSchema = z.infer<typeof signUpSchema>;

/* =======================
   Component
======================= */

export function UserStatus() {
  const { data: session } = auth.useSession();
  const router = useRouter();

  const signInForm = useForm<SignInSchema>({
    defaultValues: {
      email: "",
      password: "",
      rememberMe: false,
    },
  });

  const signUpForm = useForm<SignUpSchema>({
    defaultValues: {
      name: "",
      email: "",
      password: "",
    },
  });

  const rememberMe = useWatch({
    control: signInForm.control,
    name: "rememberMe",
  });

  const [open, setOpen] = useState(false);
  const [loginPasswordVisible, setLoginPasswordVisible] = useState(false);
  const [signupPasswordVisible, setSignupPasswordVisible] = useState(false);

  const isLogged = Boolean(session?.user);

  async function handleSignIn(rawData: SignInSchema) {
    const parsed = signInSchema.safeParse(rawData);

    if (!parsed.success) {
      // Limpa erros anteriores e marca campos com problemas
      signInForm.clearErrors();
      parsed.error.issues.forEach((issue) => {
        const field = issue.path[0] as keyof SignInSchema;
        signInForm.setError(field, {
          type: "manual",
          message: issue.message,
        });
      });
      addToast({
        title: "Dados inválidos",
        description: parsed.error.issues[0]?.message,
        color: "danger",
      });
      return;
    }

    const data = parsed.data;

    await auth.signIn.email(
      {
        email: data.email,
        password: data.password,
        rememberMe: data.rememberMe,
        callbackURL: process.env.NEXT_PUBLIC_WEB_URL,
      },
      {
        onSuccess: () => {
          addToast({
            title: "Logado com sucesso",
            color: "success",
          });
          setOpen(false);
          router.push("/dashboard");
        },
        onError: () => {
          signInForm.setError("email", {
            type: "manual",
            message: "Credenciais inválidas",
          });
          signInForm.setError("password", {
            type: "manual",
            message: "Credenciais inválidas",
          });
          addToast({
            title: "Erro ao entrar",
            description: "Credenciais inválidas",
            color: "danger",
          });
        },
      }
    );
  }

  async function handleSignUp(rawData: SignUpSchema) {
    const parsed = signUpSchema.safeParse(rawData);

    if (!parsed.success) {
      signUpForm.clearErrors();
      parsed.error.issues.forEach((issue) => {
        const field = issue.path[0] as keyof SignUpSchema;
        signUpForm.setError(field, {
          type: "manual",
          message: issue.message,
        });
      });
      addToast({
        title: "Dados inválidos",
        description: parsed.error.issues[0]?.message,
        color: "danger",
      });
      return;
    }

    const data = parsed.data;

    await auth.signUp.email(
      {
        ...data,
        callbackURL: process.env.NEXT_PUBLIC_WEB_URL,
      },
      {
        onSuccess: () => {
          addToast({
            title: "Conta criada",
            color: "success",
          });
          setOpen(false);
          router.push("/dashboard");
        },
        onError: () => {
          signUpForm.setError("email", {
            type: "manual",
            message: "Não foi possível criar a conta",
          });
          addToast({
            title: "Erro no cadastro",
            description: "Não foi possível criar a conta",
            color: "danger",
          });
        },
      }
    );
  }

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        variant="light"
        className="flex items-center gap-2"
        aria-label={isLogged ? "Abrir dashboard" : "Entrar"}
        title={isLogged ? "Abrir dashboard" : "Entrar"}
      >
        {session?.user ? (
          <Link href="/dashboard">
            <Image
              src={session.user.image || ""}
              alt={session.user.name || "User"}
              width={16}
              height={16}
              className="rounded-full"
            />
            {/* <span className="ml-2 text-sm font-medium">{session.user.name || "Perfil"}</span> */}
          </Link>
        ) : (
          <div className="flex items-center gap-2">
            <FaUserCircle className="h-4 w-4" aria-hidden="true" />
            {/* <span className="text-sm font-semibold">Entrar</span> */}
          </div>
        )}
      </Button>

      {isLogged ? null : (
        <Modal isOpen={open} onOpenChange={setOpen} placement="center">
          <ModalContent>
            <>
              <ModalHeader>
                {isLogged ? "Perfil do Usuário" : "Autenticação"}
              </ModalHeader>

              <ModalBody className="pb-8">
                <Tabs variant="underlined" fullWidth>
                  <Tab
                    key="login"
                    title={
                      <div className="flex items-center gap-2">
                        <LuUser size={18} />
                        Login
                      </div>
                    }
                  >
                    <form
                      onSubmit={signInForm.handleSubmit(handleSignIn)}
                      className="flex flex-col gap-4 mt-4"
                    >
                      <Input
                        label="E-mail"
                        type="email"
                        startContent={<LuMail />}
                        isInvalid={Boolean(signInForm.formState.errors.email)}
                        errorMessage={signInForm.formState.errors.email?.message}
                        {...signInForm.register("email")}
                      />

                      <Input
                        label="Senha"
                        type={loginPasswordVisible ? "text" : "password"}
                        startContent={<LuLock />}
                        endContent={
                          <button
                            type="button"
                            onClick={() =>
                              setLoginPasswordVisible((v) => !v)
                            }
                            aria-label={loginPasswordVisible ? "Ocultar senha" : "Mostrar senha"}
                          >
                            {loginPasswordVisible ? <LuEyeOff /> : <LuEye />}
                          </button>
                        }
                        isInvalid={Boolean(signInForm.formState.errors.password)}
                        errorMessage={signInForm.formState.errors.password?.message}
                        {...signInForm.register("password")}
                      />

                      <Checkbox
                        isSelected={rememberMe}
                        onValueChange={(v) =>
                          signInForm.setValue("rememberMe", v)
                        }
                      >
                        Lembrar de mim
                      </Checkbox>

                      <Button
                        type="submit"
                        color="primary"
                        isLoading={signInForm.formState.isSubmitting}
                      >
                        Entrar
                      </Button>
                    </form>
                  </Tab>

                  <Tab
                    key="signup"
                    title={
                      <div className="flex items-center gap-2">
                        <LuUserPlus size={18} />
                        Cadastro
                      </div>
                    }
                  >
                    <form
                      onSubmit={signUpForm.handleSubmit(handleSignUp)}
                      className="flex flex-col gap-4 mt-4"
                    >
                      <Input
                        label="Nome"
                        startContent={<LuUser />}
                        isInvalid={Boolean(signUpForm.formState.errors.name)}
                        errorMessage={signUpForm.formState.errors.name?.message}
                        {...signUpForm.register("name")}
                      />

                      <Input
                        label="E-mail"
                        type="email"
                        startContent={<LuMail />}
                        isInvalid={Boolean(signUpForm.formState.errors.email)}
                        errorMessage={signUpForm.formState.errors.email?.message}
                        {...signUpForm.register("email")}
                      />

                      <Input
                        label="Senha"
                        type={signupPasswordVisible ? "text" : "password"}
                        startContent={<LuLock />}
                        endContent={
                          <button
                            type="button"
                            onClick={() =>
                              setSignupPasswordVisible((v) => !v)
                            }
                            aria-label={signupPasswordVisible ? "Ocultar senha" : "Mostrar senha"}
                          >
                            {signupPasswordVisible ? <LuEyeOff /> : <LuEye />}
                          </button>
                        }
                        isInvalid={Boolean(signUpForm.formState.errors.password)}
                        errorMessage={signUpForm.formState.errors.password?.message}
                        {...signUpForm.register("password")}
                      />

                      <Button
                        type="submit"
                        color="primary"
                        isLoading={signUpForm.formState.isSubmitting}
                      >
                        Criar conta
                      </Button>
                    </form>
                  </Tab>
                </Tabs>
              </ModalBody>
            </>
          </ModalContent>
        </Modal>
      )}
    </>
  );
}
