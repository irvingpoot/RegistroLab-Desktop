// src/utils/localUser.ts

interface Usuario {
    id: string;
    firstName: string;
    lastName: string;
}

const DB_USUARIOS: Record<string, Usuario> = {
    "irvingpoot": { id: "irvingpoot", firstName: "Irving", lastName: "Poot"},
    "lizcristobal": { id: "lizcristobal", firstName: "Liz", lastName: "Cristóbal" },
    "jesusmoo": { id: "jesusmoo", firstName: "Jesús", lastName: "Moo" },
    "jacqiravell": { id: "jacqiravell", firstName: "Jacquelin", lastName: "Ravell" },
    "sorayashurair": { id: "sorayashurair", firstName: "Soraya", lastName: "Shurair" },
    "litzybalam": { id: "litzybalam", firstName: "Litzy", lastName: "Balam" },
    "fridaflores": { id: "fridaflores", firstName: "Frida", lastName: "Flores" }
};

export const getLocalUser = (AstroCookies: any) => {
    const userId = AstroCookies.get("user_session")?.value;
    
    if (userId && DB_USUARIOS[userId]) {
        return DB_USUARIOS[userId];
    }
    
    return null;
};