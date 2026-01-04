<div align="center">
  <img
    src="https://github.com/user-attachments/assets/fe8a16bc-0ffb-4bc0-a64f-72467c2e7ed9"
    width="672"
    height="448"
    alt="BedFlow logo"
  />
</div>


<p align="center">
  <strong>Clinical Handover & Bed Management Platform</strong><br/>
  <em>Plataforma de Passagem de Turno Clínica e Gestão de Camas</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Frontend-React%20(Vite)-0B5FA5?logo=react&logoColor=white" />
  <img src="https://img.shields.io/badge/Backend-NestJS-0B5FA5?logo=nestjs&logoColor=white" />
  <img src="https://img.shields.io/badge/ORM-Prisma-16B8A6?logo=prisma&logoColor=white" />
  <img src="https://img.shields.io/badge/Database-SQLite%20%7C%20PostgreSQL-16B8A6" />
  <img src="https://img.shields.io/badge/License-MIT-6B7280" />
  <img src="https://img.shields.io/badge/Status-Concept%20%2F%20Demo-6B7280" />
</p>

---

## Demo

https://github.com/user-attachments/assets/75dcecf5-9e81-425c-b6b1-46a63767bbd1

---

<details open>
<summary><strong>🇬🇧 English</strong></summary>

<br/>

> ⚠️ **Disclaimer**
>
> BedFlow is a **conceptual / demonstration project**.
> It is designed for **clinical operations modelling and workflow exploration**.
>  
> It must **not** be used with real identifiable patient data (PHI) without appropriate security review, regulatory compliance, and information governance.

---

## Overview

**BedFlow** is a clinical operations support platform designed **from a nursing and care‑coordination perspective** to support:

- Bed capacity management and real‑time visibility  
- Structured clinical handover between shifts and teams  
- Coordination across ambulatory, inpatient, and multi‑service settings  
- Operational auditability, traceability, and governance  

The platform focuses on **operational safety, continuity of care, and workflow reliability**, not on clinical decision‑making.

---

## Intended Audience

- Nurses and nurse managers  
- Bed management and clinical operations teams  
- Health IT and digital health professionals  
- Developers and architects exploring clinical workflow platforms  

---

## Core Capabilities

- **Bed management** – allocation, visibility, and patient flow support  
- **Shift handover** – structured updates and continuity across teams  
- **Procedure and theatre planning** – operational alignment with available capacity  
- **Role‑based access control (RBAC)** – Nurse / Coordinator / Administrator  
- **Audit and exports** – operational governance, traceability, and reporting  

---

## Architecture Overview

```
Frontend (React + Vite)
        ↓ REST API
Backend (NestJS)
        ↓ Prisma ORM
Database (SQLite / PostgreSQL)
```

---

## Technology Stack

- Frontend: React (Vite)
- Backend: NestJS
- ORM: Prisma
- Database: SQLite (default) / PostgreSQL (optional)

---

## Quick Start (Local Development)

```bash
chmod +x start.sh
./start.sh
```

### Environment configuration

The backend requires environment variables.

```bash
cd server
cp env.example .env
```

Default values are suitable for local development.

> The `.env` file is intentionally excluded from version control.

---
## Demo Access

The WalkFlow demo environment includes **preconfigured demo accounts** to explore the platform features.

> ⚠️ **Important**
>
> These credentials are **for demonstration purposes only**.
> They do **not** contain real patient data and must **never** be used in production environments.

### Demo Accounts

| Role | Username | Password |
|---|---|---|
| Administrator | `admin` | `BedFlow123` |

Role-based access control (RBAC) is enforced, and each profile exposes different operational capabilities.

---

## Security Notes (Minimum)

- Do not expose database ports publicly  
- Use a strong `JWT_SECRET`  
- Restrict CORS to authorised frontend domains  
- Remove demo credentials in any real deployment  
- RBAC enforced server‑side  
- Audit logging for critical operations  

---

## License

MIT License.  
Free to use, modify, and learn from.  
Not intended for production clinical use without appropriate validation.

</details>

---

<details>
<summary><strong>🇵🇹 Português (Portugal)</strong></summary>

<br/>

> ⚠️ **Aviso Importante**
>
> O BedFlow é um **projeto conceptual / de demonstração**, orientado para modelação de operações clínicas.
>  
> **Não deve ser utilizado com dados reais identificáveis de utentes (PHI)** sem avaliação prévia de segurança, conformidade legal e adequada governação da informação.

---

## Visão Geral

O **BedFlow** é uma plataforma de suporte à operação clínica, concebida **a partir da perspetiva da Enfermagem e da coordenação de cuidados**, com o objetivo de apoiar:

- A gestão da capacidade e visibilidade de camas  
- A passagem de turno estruturada entre equipas  
- A coordenação em contexto de internamento, ambulatório e múltiplos serviços  
- A rastreabilidade, auditoria e governação operacional  

O foco da plataforma é a **segurança operacional**, a **continuidade de cuidados** e a **fiabilidade dos processos**, não a decisão clínica.

---

## Destinatários

- Enfermeiros e enfermeiros gestores  
- Equipas de gestão de camas e operações clínicas  
- Profissionais de Sistemas de Informação em Saúde  
- Developers e arquitetos de soluções digitais em saúde  

---

## Funcionalidades Principais

- **Gestão de camas** – alocação, visibilidade e apoio ao fluxo do doente  
- **Passagem de turno** – comunicação estruturada e continuidade assistencial  
- **Planeamento de procedimentos e atividade operatória** – alinhamento com a capacidade instalada  
- **Controlo de acessos por perfis (RBAC)** – Enfermeiro / Coordenador / Administrador  
- **Auditoria e exportações** – suporte à governação e rastreabilidade operacional  

---

## Arranque Rápido (Desenvolvimento Local)

```bash
chmod +x start.sh
./start.sh
```

### Configuração de ambiente

O backend necessita de variáveis de ambiente.

```bash
cd server
cp env.example .env
```

Os valores por defeito são adequados para desenvolvimento local.

> O ficheiro `.env` encontra‑se intencionalmente excluído do controlo de versões.

---

## Acesso Demo

O ambiente de demonstração do WalkFlow inclui **contas de acesso pré-configuradas** para exploração das funcionalidades da plataforma.

> ⚠️ **Aviso Importante**
>
> Estas credenciais destinam-se **exclusivamente a fins de demonstração**.
> Não contêm dados reais de utentes e **não devem ser utilizadas em ambiente produtivo**.

### Contas de Demonstração

| Perfil | Utilizador | Palavra-passe |
|---|---|---|
| Administrador | `admin` | `BedFlow123` |

O controlo de acessos por perfil (RBAC) encontra-se ativo, estando cada utilizador limitado às permissões do respetivo papel.

---

## Licença

Licença MIT.  
Projeto educativo e conceptual.  
Não destinado a utilização clínica em produção sem validação adequada.

</details>

---

## Contact

- **Name:** Nuno da Silva Magalhães  
- **Background:** Nursing & Clinical Operations  
- **Email:** nsilvalsd@gmail.com  
- **GitHub:** https://github.com/NunoSid  
- **LinkedIn:** https://www.linkedin.com/in/nuno-da-silva-magalhães-421253199
