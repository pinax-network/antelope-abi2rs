import {Declaration} from "./abi"
import version from "./version"

interface BuiltIn {
    name: string
    type: string
    definition?: string
}

const builtins: BuiltIn[] = [
    {name: "asset", type: "String"},
    {name: "name", type: "String"},


    {name: "bool", type: "bool"},
    {name: "string", type: "String"},
    // {name: 'bytes', type: 'string | number[] | Uint8Array'},

    {name: "checksum160", type: "String"},
    {name: "checksum256", type: "String"},
    {name: "checksum512", type: "String"},

    {name: "private_key", type: "String"},
    {name: "public_key", type: "String"},
    {name: "signature", type: "String"},

    {name: "symbol", type: "String"},
    {name: "symbol_code", type: "String"},

    {name: "time_point", type: "String"},
    {name: "time_point_sec", type: "String"},
    {name: "block_timestamp_type", type: "String"},

    {name: "int8", type: "i8"},
    {name: "int16", type: "i16"},
    {name: "int32", type: "i32"},
    {name: "int64", type: "i64"},
    {name: "int128", type: "String"},

    {name: "uint8", type: "u8"},
    {name: "uint16", type: "u16"},
    {name: "uint32", type: "u32"},
    {name: "uint64", type: "u64"},
    {name: "uint128", type: "String"},

    {name: "float32", type: "String"},
    {name: "float64", type: "String"},
    {name: "float128", type: "String"},

]

const nonPrimitives: BuiltIn[] = [
    { name: "extended_asset", type: "ExtendedAsset", definition:
`pub struct ExtendedAsset {
    pub quantity: Name,
    pub contract: Name,
}`
    },
]

const imports = `use serde::{Deserialize, Serialize};
`

const structTags = `#[derive(Serialize, Deserialize, Debug)]
#[serde(deny_unknown_fields)]`

const macros = `
macro_rules! impl_try_from_str {
    ($type:ty) => {
        impl TryFrom<&str> for $type {
            type Error = serde_json::Error;
            #[inline]
            fn try_from(str: &str) -> Result<Self, Self::Error> {
                serde_json::from_str(str)
            }
        }
    };
}
`

function macrosCalls(type: string) {
    return `impl_try_from_str!(${type});`
}

function resolveOptional(type: string) {
    let name = type
    let optional = false
    if (name[name.length - 1] === "?") {
        optional = true
        name = name.slice(0, -1)
    }
    return {optional, name}
}

const RustKeywords = ["type", "pub", "struct", "use", "enum", "impl", "for", "self", "super", "crate", "mod", "fn", "const", "static", "trait", "unsafe", "extern"]
function resolveVarName(name: string) {
    return RustKeywords.includes(name) ? `r#${name}` : name
}


export interface TransformOptions {
    /** Function that is used to format type names, e.g. snake_case to PascalCase. */
    typeFormatter: (type: string) => string
    /** String to use as indentation. */
    indent: string
}

function bail(message: string) {
    process.stderr.write(message)
    process.exit(1)
}

/** Returns typescript typings for given abi. */
export default function transform(abi: Declaration, options: TransformOptions) {
    const {indent, typeFormatter} = options
    const usedBuiltins = new Set<BuiltIn>()
    const usedNonPrimitives = new Set<BuiltIn>()
    let out: string[] = ["", macros]
    const resolveType = (type: string) => {
        const {name, optional} = resolveOptional(type)

        const isArray = name.includes("[]")
        const typeName = name.replace("[]", "")
        const builtin = builtins.find((t) => t.name === typeName)
        if (builtin) usedBuiltins.add(builtin)

        const nonprim = nonPrimitives.find((t) => t.name === typeName)
        if (nonprim) usedNonPrimitives.add(nonprim)

        const rv = isArray ? `Vec<${typeFormatter(typeName)}>` : typeFormatter(typeName)
        // if (optional) {
        //     rv += ' | undefined'
        // }
        return rv
    }

    for (const type of abi.types || []) {
        out.push(
            `type ${resolveType(type.new_type_name)} = ${resolveType(type.type)};`
        )
    }

    out.push("")

    for (const variant of abi.variants || []) {
        bail("variants are not supported yet")
        // const types = variant.types.map((t) => `['${t}', ${resolveType(t)}]`)
        // out.push(`type ${typeFormatter(variant.name)} = ${types.join(' | ')}`)
    }

    out.push("")

    for (const struct of abi.structs || []) {
        out.push(structTags)
        const def = `pub struct ${typeFormatter(struct.name)}`
        if (struct.base && struct.base.length > 0) {
            bail("structs with base are not supported yet")
            // def += ` extends ${typeFormatter(struct.base)}`
        }
        out.push(def + " {")
        for (const type of struct.fields) {
            const {name, optional} = resolveOptional(type.type)
            out.push(`${indent}pub ${resolveVarName(type.name)}${optional ? "" : ""}: ${resolveType(name)},`)
        }
        out.push("}")
        out.push(macrosCalls(typeFormatter(struct.name)))
        out.push("")
    }

    out.push("")

    // future: add runtime and define interfaces for
    //         interacting with actions and tables


    for (const type of [...usedNonPrimitives].sort(
        (a, b) => builtins.indexOf(b) - builtins.indexOf(a)
    )) {
        if(!type.definition) bail("missing definition for non primitive type: " + type.name)
        out.splice(0, 0, `\n${structTags}\n${type.definition}`)
    }
    out.push("")

    for (const type of [...usedBuiltins].sort(
        (a, b) => builtins.indexOf(b) - builtins.indexOf(a)
    )) {
        if(typeFormatter(type.name) !== type.type){
            out.splice(0, 0, `type ${typeFormatter(type.name)} = ${type.type};`)
        }
    }
    out.push("")

    // remove any double newlines
    out = out.filter((line, i, all) => !(line === "" && all[i - 1] === ""))

    out.unshift(imports)
    out.unshift(`// Generated by antelope-abi2rs ${version} - ${abi.version}\n`)

    return out
}
