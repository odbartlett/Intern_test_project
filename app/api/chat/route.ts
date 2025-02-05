import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';
import { supabase } from '@/lib/supabaseClient';
import { NextResponse } from 'next/server';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    // Extract the Supabase session token from the request headers
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized: Missing or invalid token' },
        { status: 401 }
      );
    }

    const token = authHeader.split(' ')[1];

    // Verify the token
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid token' },
        { status: 401 }
      );
    }

    // Extract `messages` and `id` from the request body
    const { messages, id } = await req.json();

    // Validate required fields
    if (!id) {
      return NextResponse.json(
        { error: 'Missing chat ID' },
        { status: 400 }
      );
    }

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'Invalid or missing messages array' },
        { status: 400 }
      );
    }

    const userId = user.id; // Use the authenticated user's ID

    console.log('Chat ID:', id); // Used for persisting chat

    // Save the user's message to Supabase
    const userMessage = messages[messages.length - 1];
    if (userMessage.role === 'user') {
      const { error: userMessageError } = await supabase
        .from('chat_history')
        .insert([
          {
            chat_id: id,
            user_id: userId,
            message: userMessage.content,
            role: userMessage.role,
          },
        ]);

      if (userMessageError) {
        console.error('Error saving user message:', userMessageError);
        return NextResponse.json(
          { error: 'Failed to save user message' },
          { status: 500 }
        );
      }
    }

    // Call the language model
    const result = await streamText({
      model: openai('gpt-4o'),
      messages,
      async onFinish({ text, usage, finishReason }) {
        // Save the AI's response to Supabase
        const { error: aiResponseError } = await supabase
          .from('chat_history')
          .insert([
            {
              chat_id: id,
              user_id: userId,
              message: text,
              role: 'assistant',
            },
          ]);

        if (aiResponseError) {
          console.error('Error saving AI response:', aiResponseError);
        }

        // Log token usage and finish reason
        console.log('Token usage:', usage);
        console.log('Finish reason:', finishReason);
      },
    });

    // Respond with the stream
    return result.toDataStreamResponse();
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}