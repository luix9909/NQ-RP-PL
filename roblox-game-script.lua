-- NQ PL RP MDT Integration Script
-- Place this in ServerScriptService

local HttpService = game:GetService("HttpService")
local Players = game:GetService("Players")

-- Configuration
local BACKEND_URL = "https://YOUR_BACKEND_URL.com/api" -- Your Firebase Functions URL
local API_KEY = "YOUR_API_KEY" -- Secure API key for your backend

-- Function to send player data to backend
local function sendPlayerData(player, action)
    local data = {
        userId = player.UserId,
        jobId = game.JobId,
        team = player.Team and player.Team.Name or "Neutral",
        action = action, -- "join", "leave", "teamChange"
        timestamp = os.time()
    }
    
    local success, response = pcall(function()
        return HttpService:PostAsync(
            BACKEND_URL .. "/session",
            HttpService:JSONEncode(data),
            Enum.HttpContentType.ApplicationJson,
            false,
            {["Authorization"] = "Bearer " .. API_KEY}
        )
    end)
    
    if not success then
        warn("Failed to send player data:", response)
    end
end

-- Player joined
Players.PlayerAdded:Connect(function(player)
    -- Wait for character to load and team to be assigned
    player.CharacterAdded:Connect(function(character)
        task.wait(2) -- Wait for team assignment
        sendPlayerData(player, "join")
    end)
    
    -- Listen for team changes
    player:GetPropertyChangedSignal("Team"):Connect(function()
        sendPlayerData(player, "teamChange")
    end)
end)

-- Player leaving
Players.PlayerRemoving:Connect(function(player)
    sendPlayerData(player, "leave")
end)

-- Clean up on server shutdown
game:BindToClose(function()
    for _, player in ipairs(Players:GetPlayers()) do
        sendPlayerData(player, "leave")
    end
    task.wait(2)
end)

print("NQ PL RP MDT Integration loaded successfully")