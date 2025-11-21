"use client"

import supabase from "../../config/supabaseClient"

export default function Test() {

    const handleSubmit = async (e) => {
        const { data, error } = await supabase
            .from("Account")
            .insert([
                {
                    email: "test@gmail.com",
                    name: "jade",
                    id: 1
                }
            ])
        
            if (error) {
                console.log(error)
            }

            if (data) {
                console.log(data)
            }
    }

    const buttonTest = async (e) => {
        console.log("hello")
    }

    return (
        <div>
            <button
                onClick={handleSubmit}
                className="w-full mt-6 px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-lg shadow-md transition-all duration-200 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                {"hello"}
            </button>
            
        </div>
    )
}