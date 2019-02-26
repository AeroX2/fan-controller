package fancontroller.jridey.com.fancontroller

import retrofit2.Call
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST

data class ResponseModel(
    val response: String
)

data class TimeoutModel(
    val hours: Int,
    val minutes: Int,
    val seconds: Int
)

data class ControlModel(
        val command: String,
        val timeout: TimeoutModel?
)

interface APIInterface {
    @GET("/")
    fun root(): Call<ResponseModel>

    @POST("/control")
    fun control(@Body control: ControlModel): Call<ResponseModel>
}